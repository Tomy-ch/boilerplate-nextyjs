#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  listFilesRecursive,
  readUtf8File,
  toAbsolutePath,
  toRelativePath,
} from "../lib/file-utils.js";
import { exitWithUsage, parseCommonFlags, ROOT_DIR } from "../lib/runtime.js";
import {
  ensurePackageName,
  ensureRepositoryReference,
  normalizePortalUrl,
} from "../lib/validators.js";
import { planReplacement } from "./plan.js";
import { buildDefaultPortalUrl } from "./portal.js";

type Options = {
  repository?: string;
  portalUrl?: string;
  dryRun: boolean;
  help: boolean;
  rest: string[];
};

type PlannedChange = {
  filePath: string;
  relativePath: string;
  content: string;
  occurrences: number;
};

const PACKAGE_JSON = "package.json";

const TARGET_EXTENSIONS = new Set([
  ".md",
  ".json",
  ".jsonc",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".yaml",
  ".yml",
  ".toml",
  ".mk",
]);
const TARGET_FILE_NAMES = new Set(["Makefile"]);

// docs は boilerplate 自身の設計記録であり、作った側の名前へ書き換える対象ではない。
// .claude はエージェント設定と worktree の実体を含む。
const EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".claude",
  "dist",
  "build",
  "docs",
  "tmp",
]);
const EXCLUDED_FILE_NAMES = new Set(["pnpm-lock.yaml"]);
const EXCLUDED_PATH_PREFIXES = [`scripts${path.sep}setup${path.sep}`];

function printUsage(): void {
  console.log(`使用方法:
  tsx scripts/setup/replace-repository-reference --repository <owner/repo> [--portal-url <url>] [--dry-run]

例:
  tsx scripts/setup/replace-repository-reference --repository example-org/example-app
  tsx scripts/setup/replace-repository-reference --repository example-org/example-app --portal-url https://docs.example.com/
  tsx scripts/setup/replace-repository-reference --repository example-org/example-app --dry-run

補足:
  置換元は package.json の name（現在のプロジェクト名）です。
  <owner>/<現プロジェクト名> 形式のリポジトリ参照と、単独のプロジェクト名の両方を置換します。
  ドキュメントポータルへのリンクも同時に差し替えます。--portal-url を省くと GitHub Pages の
  配信先（https://<owner>.github.io/<repo>/）を使います。custom domain を使う場合に渡します。
  docs 配下・.claude 配下・scripts/setup 配下・ビルド成果物・ロックファイルは対象外です。
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = parseCommonFlags(argv);
  const args = options.rest;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg !== "--repository" && arg !== "--portal-url") {
      throw new Error(`不明な引数です: ${arg}`);
    }

    const value = args[i + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} の値を指定してください。`);
    }

    if (arg === "--repository") {
      options.repository = value;
    } else {
      options.portalUrl = value;
    }

    i += 1;
  }

  if (options.help) {
    return options;
  }

  if (!options.repository) {
    throw new Error("--repository は必須です。");
  }

  ensureRepositoryReference(options.repository);
  ensurePackageName(options.repository.split("/")[1]);

  // 検証しただけの生値を後段へ流さない。戻り値を捨てると入口の検査が意味を失う
  if (options.portalUrl !== undefined) {
    options.portalUrl = normalizePortalUrl(options.portalUrl);
  }

  return options;
}

function readCurrentProjectName(): string {
  const content = fs.readFileSync(toAbsolutePath(PACKAGE_JSON), "utf8");
  const { name } = JSON.parse(content) as { name?: string };

  if (!name) {
    throw new Error("package.json に name フィールドが見つかりませんでした。");
  }

  return name;
}

function shouldProcessFile(filePath: string): boolean {
  const relativePath = path.relative(ROOT_DIR, filePath);
  const fileName = path.basename(filePath);

  if (EXCLUDED_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
    return false;
  }

  if (EXCLUDED_FILE_NAMES.has(fileName)) {
    return false;
  }

  return TARGET_FILE_NAMES.has(fileName) || TARGET_EXTENSIONS.has(path.extname(filePath));
}

function planFile(
  filePath: string,
  currentName: string,
  repository: string,
  portalUrl: string,
): PlannedChange | null {
  const original = readUtf8File(filePath);

  if (original === null) {
    return null;
  }

  const relativePath = toRelativePath(filePath);
  const planned = planReplacement(relativePath, original, currentName, repository, portalUrl);

  return planned === null ? null : { filePath, relativePath, ...planned };
}

// 途中失敗で一部だけ書き換わった状態を残さないため、全ファイルの書き込み可否を先に確かめる
function commit(planned: PlannedChange[]): void {
  for (const change of planned) {
    fs.accessSync(change.filePath, fs.constants.W_OK);
  }

  for (const change of planned) {
    fs.writeFileSync(change.filePath, change.content);
  }
}

function run(repository: string, portalUrl: string, dryRun: boolean): void {
  const currentName = readCurrentProjectName();
  const newName = repository.split("/")[1];

  if (currentName === newName) {
    console.log(`プロジェクト名は既に ${newName} です。リポジトリ参照のみ確認します。`);
  }

  console.log(`ドキュメントポータルのリンク先: ${portalUrl}`);

  const files = listFilesRecursive(ROOT_DIR, {
    excludedDirectories: EXCLUDED_DIRECTORIES,
    shouldIncludeFile: shouldProcessFile,
  });

  const planned: PlannedChange[] = [];

  for (const filePath of files) {
    const change = planFile(filePath, currentName, repository, portalUrl);

    if (change) {
      planned.push(change);
    }
  }

  if (planned.length === 0) {
    console.log("置換対象は見つかりませんでした。");
    return;
  }

  planned.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  if (!dryRun) {
    commit(planned);
  }

  const total = planned.reduce((sum, change) => sum + change.occurrences, 0);
  console.log(`${dryRun ? "ドライラン" : "置換完了"}: ${planned.length}ファイル / ${total}箇所`);

  for (const change of planned) {
    console.log(`- ${change.relativePath} (${change.occurrences}箇所)`);
  }
}

function main(): void {
  let options: Options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    exitWithUsage(error as Error, printUsage);
  }

  if (options.help || !options.repository) {
    printUsage();
    return;
  }

  try {
    run(
      options.repository,
      options.portalUrl ?? buildDefaultPortalUrl(options.repository),
      options.dryRun,
    );
  } catch (error) {
    console.error(`エラー: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();

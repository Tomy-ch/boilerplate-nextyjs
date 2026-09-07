import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { z } from "zod";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const manifestPath = resolve(repositoryRoot, "src/components/shadcn-manifest.yaml");
const componentsDirectoryPath = resolve(repositoryRoot, "src/components");
const COMPONENTS_ROOT = "src/components";

/**
 * component ディレクトリの目印。
 *
 * 実装ファイルの拡張子では判定できない。CSS 基盤は `.tsx` を持たず、`patterns/table` の配下は入れ子になり、
 * 同じディレクトリに実装・test・story が並ぶ。「component ごとに README を co-locate する」は
 * `components/README.md` が定める規約なので、これを唯一の目印にする。
 */
const COMPONENT_MARKER = "README.md";

/** component ではないディレクトリ。台帳の対象にしない。 */
const EXCLUDED_DIRECTORIES: ReadonlySet<string> = new Set([`${COMPONENTS_ROOT}/scripts`]);
const UPSTREAM_API_URL = "https://api.github.com";
const UPSTREAM_RAW_URL = "https://raw.githubusercontent.com";

const registrySourceSchema = z.object({
  repository: z.string(),
  path: z.string(),
  localPath: z.string(),
  commit: z.string(),
  committedAt: z.iso.datetime(),
});

/**
 * `components/README.md` の component 目録で、その component が載る見出し。
 *
 * @remarks
 * `design-system` の部品は目的ごとの見出しに分かれ、それ以外の層は目的で割らないため `as` だけが見出しを持つ。
 * `navigation` のように両方へ現れる値があるのは、同じ目的の部品が基底と合成の両方に存在する
 * ためであり、どちらの層かは `directory` が持つ。目的と層は別の軸なので畳まない。
 */
export const CATALOG_HEADING = {
  ACTION: "action",
  FORM: "form",
  OVERLAY: "overlay",
  NAVIGATION: "navigation",
  DISPLAY: "display",
  STATUS: "status",
  CONTAINER: "container",
  FOUNDATION: "foundation",
  LAYOUT: "layout",
  FEEDBACK: "feedback",
  RICH_TEXT: "rich-text",
  VIEW_STATE: "view-state",
  SUGAR: "sugar",
} as const;

/** {@link CATALOG_HEADING} の値。 */
export type CatalogHeading = (typeof CATALOG_HEADING)[keyof typeof CATALOG_HEADING];

/**
 * component を置く層。`components/` 直下のディレクトリ名と一致する。
 *
 * @remarks
 * 層は「その部品を誰が書き換えるか」で決まり、目的（{@link CATALOG_HEADING}）とは別の軸である。
 * 畳まずに両方を持つ。判定は契約から先に当てる。
 *
 * - `design-system` — 契約を知らず、読んでも役割が増えない。目的別に置く
 * - `patterns` — 契約は知らないが、複数の役割を合成する。目的を一つに決められないので割らない
 * - `shell` — アプリのどこに・いくつ置くかが部品側で決まっている。mount 位置が制約になる
 * - `app-starter` — バックエンドの契約を知っている。テンプレートから作った側が作り替える前提
 */
export const COMPONENT_LAYER = {
  DESIGN_SYSTEM: "design-system",
  PATTERNS: "patterns",
  SHELL: "shell",
  APP_STARTER: "app-starter",
} as const;

/** {@link COMPONENT_LAYER} の値。 */
export type ComponentLayer = (typeof COMPONENT_LAYER)[keyof typeof COMPONENT_LAYER];

export const componentLayerSchema = z.enum([
  COMPONENT_LAYER.DESIGN_SYSTEM,
  COMPONENT_LAYER.PATTERNS,
  COMPONENT_LAYER.SHELL,
  COMPONENT_LAYER.APP_STARTER,
]);

/**
 * 層と目的から、component ディレクトリのリポジトリ相対パスを組み立てる。
 *
 * @remarks
 * `design-system` だけが目的別の中間ディレクトリを持つ。他の二つは目的を一つに決められない
 * ものの置き場なので、割らずに直下へ並べる。
 */
export function componentDirectoryOf(
  layer: ComponentLayer,
  as: CatalogHeading,
  component: string,
): string {
  return layer === COMPONENT_LAYER.DESIGN_SYSTEM
    ? `${COMPONENTS_ROOT}/${layer}/${as}/${component}`
    : `${COMPONENTS_ROOT}/${layer}/${component}`;
}

/**
 * 見出しに対応する Storybook sidebar の表示名。
 *
 * @remarks
 * sidebar の区画は目録の見出しと同じである。並び順は `.storybook/preview.tsx` の `storySort` が持つ。
 */
export const CATALOG_HEADING_TITLE: Readonly<Record<CatalogHeading, string>> = {
  [CATALOG_HEADING.ACTION]: "Action",
  [CATALOG_HEADING.FORM]: "Form",
  [CATALOG_HEADING.OVERLAY]: "Overlay",
  [CATALOG_HEADING.NAVIGATION]: "Navigation",
  [CATALOG_HEADING.DISPLAY]: "Display",
  [CATALOG_HEADING.STATUS]: "Status",
  [CATALOG_HEADING.CONTAINER]: "Container",
  [CATALOG_HEADING.FOUNDATION]: "Foundation",
  [CATALOG_HEADING.LAYOUT]: "Layout",
  [CATALOG_HEADING.FEEDBACK]: "Feedback",
  [CATALOG_HEADING.RICH_TEXT]: "Rich Text",
  [CATALOG_HEADING.VIEW_STATE]: "View State",
  [CATALOG_HEADING.SUGAR]: "Sugar",
};

/**
 * story の定義から `title` の先頭セグメントを取り出す。
 *
 * @remarks
 * `title` を持たない story は Storybook が配置を自動生成するため、sidebar が規約から外れる。
 * 取り出せなかったことを `undefined` で表し、呼び出し元が欠落として報告する。
 */
export function storyHeadingOf(source: string): string | undefined {
  return /title:\s*"([^"/]+)\//.exec(source)?.[1];
}

export const catalogHeadingSchema = z.enum([
  CATALOG_HEADING.ACTION,
  CATALOG_HEADING.FORM,
  CATALOG_HEADING.OVERLAY,
  CATALOG_HEADING.NAVIGATION,
  CATALOG_HEADING.DISPLAY,
  CATALOG_HEADING.STATUS,
  CATALOG_HEADING.CONTAINER,
  CATALOG_HEADING.FOUNDATION,
  CATALOG_HEADING.LAYOUT,
  CATALOG_HEADING.FEEDBACK,
  CATALOG_HEADING.RICH_TEXT,
  CATALOG_HEADING.VIEW_STATE,
  CATALOG_HEADING.SUGAR,
]);

const presentComponentEntrySchema = z.object({
  kind: z.enum(["copy-in", "reimplemented", "original"]),
  layer: componentLayerSchema,
  as: catalogHeadingSchema,
  registryItem: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  directory: z.string(),
  source: z.array(registrySourceSchema).optional(),
});

/** 検討したうえで作らないと決めたもの。実体が無いので、突き合わせる相手も追従先も持たない。 */
const notAdoptedEntrySchema = z.object({
  kind: z.literal("not-adopted"),
  registryItem: z.string().optional(),
  reason: z.string(),
  revisitWhen: z.string(),
  decidedAt: z.iso.datetime(),
});

const componentManifestSchema = z.object({
  schemaVersion: z.literal(1),
  components: z.record(
    z.string(),
    z.discriminatedUnion("kind", [presentComponentEntrySchema, notAdoptedEntrySchema]),
  ),
});

const upstreamCommitSchema = z.object({
  sha: z.string(),
  commit: z.object({ committer: z.object({ date: z.string() }) }),
});

const upstreamCommitsSchema = z.tuple([upstreamCommitSchema], upstreamCommitSchema);

type RegistrySource = z.infer<typeof registrySourceSchema>;

/** 上流が動いた component と、その差分を読むための情報。 */
export type ComponentDrift = {
  component: string;
  kind: "copy-in" | "reimplemented";
  path: string;
  recorded: string;
  latest: string;
  latestCommittedAt: string;
};

/** 追従判断のために確認した結果。 */
export type CheckResult = {
  checked: number;
  skipped: string[];
  drifted: ComponentDrift[];
  failed: string[];
};

/**
 * 記録した commit と上流の最新を突き合わせ、動いたものを返す。
 *
 * `original` は上流を持たないため確認しない。`reimplemented` は追従対象ではないが、上流の
 * 変更が自前実装の見直し材料になるため確認対象に含める。
 */
export async function checkUpstreamDrift(
  fetchUpstreamJson: (url: string) => Promise<unknown>,
  manifestSource: string,
): Promise<CheckResult> {
  const manifest = componentManifestSchema.parse(parse(manifestSource));
  const result: CheckResult = { checked: 0, skipped: [], drifted: [], failed: [] };

  for (const [component, entry] of Object.entries(manifest.components)) {
    if (entry.kind === "not-adopted" || entry.kind === "original" || entry.source === undefined) {
      result.skipped.push(component);
      continue;
    }

    for (const source of entry.source) {
      result.checked += 1;
      try {
        // biome-ignore lint/performance/noAwaitInLoops: 記録件数ぶんの GitHub API 呼び出しを並列化すると、subprocess の大量生成と API のレート制限を同時に踏む
        const [latest] = upstreamCommitsSchema.parse(await fetchUpstreamJson(commitsUrl(source)));
        if (latest.sha === source.commit) continue;
        result.drifted.push({
          component,
          kind: entry.kind,
          path: source.path,
          recorded: source.commit,
          latest: latest.sha,
          latestCommittedAt: latest.commit.committer.date,
        });
      } catch (error) {
        result.failed.push(
          `${component}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return result;
}

function commitsUrl(source: RegistrySource): string {
  return `${UPSTREAM_API_URL}/repos/${source.repository}/commits?path=${encodeURIComponent(source.path)}&per_page=1`;
}

/** 差分を読むための 3-way merge 用 URL を組み立てる。 */
export function baselineUrl(repository: string, commit: string, path: string): string {
  return `${UPSTREAM_RAW_URL}/${repository}/${commit}/${path}`;
}

/** import 元として現れても外部依存として数えない、実行環境そのもの。 */
const RUNTIME_PACKAGES: ReadonlySet<string> = new Set(["react", "react-dom"]);

/**
 * import 指定子から package 名を取り出す。
 *
 * @remarks
 * `next/image` は `next` に、`@tiptap/react` はそのまま数える。台帳が答えるのは
 * 「どの package を参照しているか」であって、その package のどの入口を使ったかではない。
 */
export function packageOf(specifier: string): string {
  const name = /^(?:@[^/]+\/)?[^/]+/.exec(specifier);
  return name === null ? specifier : name[0];
}

/**
 * 実装ファイルの中身から、参照している外部 package を取り出す。
 *
 * @remarks
 * 相対 import と `@/` の内部 import は外部依存ではない。react / react-dom は全 component が
 * 前提にする実行環境なので数えない。test と story は component の依存ではないため、呼び出し元が
 * 対象から外す。
 */
export function vendorImportsOf(sources: readonly string[]): string[] {
  const packages = new Set<string>();
  for (const source of sources) {
    for (const [, specifier] of source.matchAll(/from "([^"]+)"/g)) {
      if (specifier === undefined) continue;
      if (specifier.startsWith(".") || specifier.startsWith("@/")) continue;
      const name = packageOf(specifier);
      if (RUNTIME_PACKAGES.has(name)) continue;
      packages.add(name);
    }
  }
  return [...packages].sort();
}

/**
 * 上流ファイルのパスから registry item 名を取り出す。
 *
 * @remarks
 * 上流は 1 item = 1 ファイルで、ファイル名がそのまま item 名である。`registryItem` の宣言が
 * この対応から外れていないかを確かめるために使う。
 */
export function registryItemOf(upstreamPath: string): string {
  return upstreamPath.replace(/^.*\//, "").replace(/\.[a-z]+$/, "");
}

/**
 * component ディレクトリと、その配下のファイルを、リポジトリ相対パスの一覧から取り出す。
 *
 * @remarks
 * 層のディレクトリ（{@link COMPONENT_LAYER}）と目的のディレクトリを列挙しない。列挙すると、
 * 層や目的が増えるたびに script を直す必要が生まれ、直し忘れたものが台帳から静かに抜ける。
 * 代わりに {@link COMPONENT_MARKER} を持つディレクトリをすべて component として扱うため、
 * 入れ子になっていても、層を移しても記録漏れとして現れる。
 *
 * @param filePaths - `src/components` 配下のファイルのリポジトリ相対パス。
 */
export function collectComponentLayout(filePaths: readonly string[]): {
  directories: readonly string[];
  files: ReadonlySet<string>;
} {
  const suffix = `/${COMPONENT_MARKER}`;
  const directories = filePaths
    .filter((path) => path.endsWith(suffix))
    .map((path) => path.slice(0, -suffix.length))
    .filter((directory) => directory !== COMPONENTS_ROOT && !EXCLUDED_DIRECTORIES.has(directory));

  return { directories, files: new Set(filePaths) };
}

/**
 * 台帳としての整合性を確認する。ネットワークを使わない。
 *
 * 上流と名前が違う component があるため、対応付けを名前の一致で推測しない。各エントリが宣言する
 * `directory` と、実際に存在するディレクトリを突き合わせる。宣言があることで、実体を移動・改名
 * したときに記録漏れと取り残されたエントリの両方が検出できる。
 */
export function verifyManifestIntegrity(
  componentDirectories: readonly string[],
  existingFiles: ReadonlySet<string>,
  manifestSource: string,
  vendorImports: ReadonlyMap<string, readonly string[]> = new Map(),
  storyHeadings: ReadonlyMap<string, string | undefined> = new Map(),
): string[] {
  const manifest = componentManifestSchema.parse(parse(manifestSource));
  // 実体を持たない `not-adopted` は、ディレクトリとも story とも突き合わせる相手がいない。
  const entries = Object.entries(manifest.components).filter(
    (entry): entry is [string, z.infer<typeof presentComponentEntrySchema>] =>
      entry[1].kind !== "not-adopted",
  );
  const declared = new Map<string, string[]>();
  const problems: string[] = [];

  for (const [name, entry] of entries) {
    declared.set(entry.directory, [...(declared.get(entry.directory) ?? []), name]);
  }

  for (const directory of componentDirectories) {
    if (declared.has(directory)) continue;
    problems.push(
      `${directory}: manifest に記録がありません。kind を決めてエントリを追加してください。`,
    );
  }

  for (const [directory, names] of declared) {
    if (!componentDirectories.includes(directory)) {
      problems.push(`${names.join(" / ")}: 宣言された ${directory} が存在しません。`);
    }
    if (names.length > 1) {
      problems.push(`${names.join(" / ")}: 同じ ${directory} を宣言しています。`);
    }
  }

  for (const [name, entry] of entries) {
    if (entry.kind !== "original" && entry.source === undefined) {
      problems.push(`${name}: kind が ${entry.kind} なのに source がありません。`);
    }
    if (entry.kind === "original" && entry.source !== undefined) {
      problems.push(`${name}: kind が original なのに source があります。`);
    }
    if (entry.kind !== "original" && entry.registryItem === undefined) {
      problems.push(`${name}: kind が ${entry.kind} なのに registryItem がありません。`);
    }
    if (entry.kind === "original" && entry.registryItem !== undefined) {
      problems.push(`${name}: kind が original なのに registryItem があります。`);
    }
    const expectedDirectory = componentDirectoryOf(
      entry.layer,
      entry.as,
      entry.directory.slice(entry.directory.lastIndexOf("/") + 1),
    );
    // 入れ子の component は親が置き場を決める。層と目的から導いた場所とは一致しない
    const nested = declared.has(entry.directory.slice(0, entry.directory.lastIndexOf("/")));
    if (!nested && entry.directory !== expectedDirectory) {
      problems.push(
        `${name}: directory が ${entry.directory} ですが、layer が ${entry.layer} で as が ${entry.as} なので ${expectedDirectory} です。`,
      );
    }
    if (storyHeadings.has(entry.directory)) {
      const expected = CATALOG_HEADING_TITLE[entry.as];
      const actual = storyHeadings.get(entry.directory);
      if (actual === undefined) {
        problems.push(
          `${name}: story の title に見出しがありません。${expected}/ で始めてください。`,
        );
      } else if (actual !== expected) {
        problems.push(
          `${name}: story の title が ${actual}/ で始まっていますが、as は ${entry.as} なので ${expected}/ です。`,
        );
      }
    }
    const referenced = vendorImports.get(entry.directory);
    if (referenced !== undefined) {
      const declaredDependencies = [...(entry.dependencies ?? [])].sort();
      if (declaredDependencies.join(",") !== [...referenced].join(",")) {
        problems.push(
          `${name}: dependencies の宣言 [${declaredDependencies.join(", ")}] が、実際に参照している [${referenced.join(", ")}] と食い違っています。`,
        );
      }
    }
    for (const source of entry.source ?? []) {
      if (!existingFiles.has(source.localPath)) {
        problems.push(`${name}: source の localPath ${source.localPath} が存在しません。`);
      }
      if (entry.registryItem === undefined) continue;
      const upstreamItem = registryItemOf(source.path);
      if (upstreamItem === entry.registryItem) continue;
      problems.push(
        `${name}: registryItem ${entry.registryItem} と source の path ${source.path} が食い違っています。`,
      );
    }
  }

  return problems;
}

/**
 * 確認結果に対応する終了コードを返す。
 *
 * 上流が動いた場合も失敗として扱う。定期実行から見たときに、追従の判断が必要になったことが
 * 赤で見えるようにするためであり、`make actions-pin-check` が pin のずれで落ちるのと同じ扱いである。
 */
export function checkExitCode(result: CheckResult): number {
  return result.drifted.length > 0 || result.failed.length > 0 ? 1 : 0;
}

/** 整合性の確認結果を、そのまま読める報告へ整形する。 */
export function formatIntegrityProblems(problems: readonly string[]): string {
  if (problems.length === 0) return "manifest の整合性: 問題ありません。\n";
  return `manifest の整合性: ${String(problems.length)} 件\n${problems.map((problem) => `  ${problem}`).join("\n")}\n`;
}

/** 確認結果を、そのまま読める報告へ整形する。 */
export function formatCheckResult(result: CheckResult): string {
  const lines = [
    `確認: ${String(result.checked)} 件 / 対象外（自前実装）: ${String(result.skipped.length)} 件`,
  ];

  if (result.drifted.length === 0) {
    lines.push("上流が動いた component はありません。");
  } else {
    lines.push(`\n上流が動いた component: ${String(result.drifted.length)} 件`);
    for (const drift of result.drifted) {
      const label = drift.kind === "copy-in" ? "要追従" : "参考";
      lines.push(
        `\n  [${label}] ${drift.component}`,
        `    path        ${drift.path}`,
        `    記録         ${drift.recorded.slice(0, 12)}`,
        `    最新         ${drift.latest.slice(0, 12)}  ${drift.latestCommittedAt}`,
        `    差分         https://github.com/shadcn-ui/ui/compare/${drift.recorded.slice(0, 12)}...${drift.latest.slice(0, 12)}`,
      );
    }
  }

  if (result.failed.length > 0) {
    lines.push(`\n確認できなかったもの:`, ...result.failed.map((failure) => `  ${failure}`));
  }

  return `${lines.join("\n")}\n`;
}

/**
 * GitHub API を `gh` 経由で取得する。
 *
 * 1 回の確認で記録件数ぶんのリクエストを出すため、未認証の 60 req/hr では足りない。`gh` の
 * 認証を使うことで上限を避ける。`gh` が無い環境では、その旨がそのまま失敗として表れる。
 */
export async function fetchJson(url: string): Promise<unknown> {
  const endpoint = url.startsWith(`${UPSTREAM_API_URL}/`)
    ? url.slice(UPSTREAM_API_URL.length + 1)
    : url;
  const { stdout } = await promisify(execFile)("gh", ["api", endpoint]);
  return JSON.parse(stdout);
}

/* istanbul ignore next -- CLI のエントリポイントは pnpm check:ui が実地で通す。 */
async function main(): Promise<void> {
  const manifestSource = await readFile(manifestPath, "utf8");
  const contents = await readdir(componentsDirectoryPath, { recursive: true, withFileTypes: true });
  const filePaths = contents
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(repositoryRoot, join(entry.parentPath, entry.name)).split(sep).join("/"),
    );
  const { directories, files } = collectComponentLayout(filePaths);

  // 走査が壊れれば対象 0 件で緑になり、検査が消えたことに誰も気付かない。
  if (directories.length === 0) {
    process.stderr.write(`走査が component を 1 件も拾っていません: ${componentsDirectoryPath}\n`);
    process.exitCode = 1;
    return;
  }

  const readSources = directories.map(async (directory) => {
    const implementations = filePaths.filter(
      (path) =>
        path.startsWith(`${directory}/`) &&
        !path.slice(directory.length + 1).includes("/") &&
        /\.tsx?$/.test(path) &&
        !/\.(test|stories)\.tsx?$/.test(path),
    );
    const sources = await Promise.all(
      implementations.map((path) => readFile(resolve(repositoryRoot, path), "utf8")),
    );
    return [directory, vendorImportsOf(sources)] as const;
  });
  const vendorImports = new Map<string, readonly string[]>(await Promise.all(readSources));

  const readStories = directories.map(async (directory) => {
    const story = filePaths.find(
      (path) => path.startsWith(`${directory}/`) && path.endsWith(".stories.tsx"),
    );
    if (story === undefined) return undefined;
    const source = await readFile(resolve(repositoryRoot, story), "utf8");
    return [directory, storyHeadingOf(source)] as const;
  });
  const storyHeadings = new Map<string, string | undefined>(
    (await Promise.all(readStories)).filter((entry) => entry !== undefined),
  );

  const problems = verifyManifestIntegrity(
    directories,
    files,
    manifestSource,
    vendorImports,
    storyHeadings,
  );
  process.stdout.write(formatIntegrityProblems(problems));
  if (problems.length > 0) {
    process.exitCode = 1;
    return;
  }

  if (process.argv.includes("--offline")) return;

  const result = await checkUpstreamDrift(fetchJson, manifestSource);
  process.stdout.write(formatCheckResult(result));
  process.exitCode = checkExitCode(result);
}

/* istanbul ignore next -- 同上（`main` と同じ）。 */
if (process.argv[1]?.endsWith("check-shadcn.ts")) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

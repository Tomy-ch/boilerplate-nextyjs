#!/usr/bin/env node

// デザインシステムを、外部のデザイン支援ツールが読める 1 つの bundle として書き出す。
//
// 送り先は決めない。特定 SaaS の手順はここに書かず、`.claude/skills/` のスキルへ閉じ込める。
// ここが出すのは、どの送り先でも入力になりうる 3 つだけである。
//
//   r/*.json    shadcn registry。ソースとメタ。取り込みで使っている形式をそのまま逆向きに出す
//   catalog.md  component 目録。用途・責務境界・story 一覧と、その説明
//   tokens.css  生成済みの semantic token
//
// 依存の向きは repo → design の一本で、書き出した先の成果物を repo へ取り込む経路は作らない。
import { execFile } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { z } from "zod";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const manifestPath = resolve(repositoryRoot, "src/components/shadcn-manifest.yaml");
const tokensCssPath = resolve(repositoryRoot, "src/app/generated/tokens.css");
const storybookIndexPath = resolve(repositoryRoot, "storybook-static/index.json");
const outputDirectory = resolve(repositoryRoot, "tmp/design-bundle");

/** registry の item 種別。実体を書き換える層かどうかで分ける。 */
const presentEntrySchema = z.object({
  kind: z.enum(["copy-in", "reimplemented", "original"]),
  layer: z.enum(["design-system", "patterns", "app-starter", "shell"]),
  as: z.string(),
  directory: z.string(),
});

const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  components: z.record(
    z.string(),
    z.union([presentEntrySchema, z.object({ kind: z.literal("not-adopted") })]),
  ),
});

const storybookIndexSchema = z.object({
  entries: z.record(
    z.string(),
    z.object({
      id: z.string(),
      name: z.string(),
      title: z.string(),
      type: z.string(),
      importPath: z.string(),
    }),
  ),
});

import {
  type BundleComponent,
  bundledFilesOf,
  itemTypeOf,
  renderCatalog,
  sectionOf,
  titleOf,
} from "./catalog.js";

async function collectComponents(): Promise<BundleComponent[]> {
  const manifest = manifestSchema.parse(parse(await readFile(manifestPath, "utf8")));

  let index: z.infer<typeof storybookIndexSchema> | undefined;
  try {
    index = storybookIndexSchema.parse(JSON.parse(await readFile(storybookIndexPath, "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        "storybook-static/index.json がありません。先に pnpm build-storybook を実行してください。",
      );
    }

    // 形が変わった場合は原因を残す。「ファイルが無い」に丸めると、既にビルド済みの利用者が
    // build-storybook を回し直して同じ所で止まる。
    throw new Error("storybook-static/index.json を解釈できません。", { cause: error });
  }

  const storiesByImportPath = new Map<string, { id: string; name: string }[]>();
  for (const entry of Object.values(index.entries)) {
    if (entry.type !== "story") continue;
    const key = entry.importPath.replace(/^\.\//, "");
    storiesByImportPath.set(key, [
      ...(storiesByImportPath.get(key) ?? []),
      { id: entry.id, name: entry.name },
    ]);
  }

  const components: BundleComponent[] = [];

  for (const [name, entry] of Object.entries(manifest.components)) {
    if (entry.kind === "not-adopted") continue;

    const directory = resolve(repositoryRoot, entry.directory);
    // biome-ignore lint/performance/noAwaitInLoops: component ごとに README とディレクトリを読むだけで、並列化するほどの件数ではない
    const readme = await readFile(join(directory, "README.md"), "utf8");
    const directoryEntries = await readdir(directory, { withFileTypes: true });
    // 入れ子の component は親のディレクトリに同居する。子ディレクトリは自分の item が持つ
    const names = directoryEntries.filter((file) => file.isFile()).map((file) => file.name);
    const files = bundledFilesOf(names).map((file) =>
      relative(repositoryRoot, join(directory, file)),
    );

    components.push({
      name,
      title: titleOf(readme, name),
      layer: entry.layer,
      as: entry.as,
      directory: entry.directory,
      purpose: sectionOf(readme, "用途"),
      boundary: sectionOf(readme, "責務境界"),
      files: files.filter((file) => !file.endsWith(".stories.tsx")),
      stories: files.flatMap((file) => storiesByImportPath.get(file) ?? []),
    });
  }

  return components;
}

async function main(): Promise<void> {
  const components = await collectComponents();

  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });

  const registryPath = join(outputDirectory, "registry.json");
  await writeFile(
    registryPath,
    `${JSON.stringify(
      {
        $schema: "https://ui.shadcn.com/schema/registry.json",
        name: "nextjs-boilerplate",
        homepage: "https://github.com/",
        items: components.map((component) => ({
          name: component.name,
          type: itemTypeOf(component.layer),
          title: component.title,
          description: component.purpose,
          files: component.files.map((file) => ({ path: file, type: itemTypeOf(component.layer) })),
        })),
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(join(outputDirectory, "catalog.md"), renderCatalog(components));
  await copyFile(tokensCssPath, join(outputDirectory, "tokens.css"));

  await promisify(execFile)(
    "pnpm",
    ["exec", "shadcn", "build", registryPath, "-o", join(outputDirectory, "r")],
    { cwd: repositoryRoot },
  );

  process.stdout.write(
    `書き出しました: ${relative(repositoryRoot, outputDirectory)}（component ${components.length} 件）\n`,
  );
}

if (process.argv[1]?.endsWith("design-bundle.ts")) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

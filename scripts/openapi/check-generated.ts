#!/usr/bin/env node
// 取得済みの契約と生成物の版が揃っているかを検査する（drift ゲートの観点 2）。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { contractArtifactRoots, findStampDrift, type GeneratedArtifact } from "./generated-stamp";
import { MANIFEST_PATH, parseSourcesManifest } from "./sources-manifest";

function collectArtifacts(root: string): GeneratedArtifact[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);

      return { path, content: readFileSync(path, "utf8") };
    });
}

const sources = parseSourcesManifest(readFileSync(MANIFEST_PATH, "utf8"));
const artifacts = sources.flatMap((source) =>
  contractArtifactRoots(source.name).flatMap(collectArtifacts),
);
const drift = findStampDrift(sources, artifacts);

if (drift.length > 0) {
  console.error("❌ 契約と生成物の版が揃っていません:");

  for (const message of drift) {
    console.error(`  - ${message}`);
  }

  console.error("  make api-gen を実行してください。");
  process.exit(1);
}

console.log(`✅ ${sources.length} 件の契約と生成物 ${artifacts.length} 件の版が一致しています`);

#!/usr/bin/env node
// 生成した zod スキーマから、検証を伴わない定数だけの module を作る（make gen-api の一部）。
//
// 契約の上限値は client も要るが、それを取るために生成スキーマを import すると、**全エンドポイントの
// スキーマと説明文がブラウザへ配られる**。
// 定数だけを別 module へ写し、client はそちらだけを引く。
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { collectContractLimits, renderContractLimits } from "./contract-limits";
import { MANIFEST_PATH, parseSourcesManifest } from "./sources-manifest";

const sources = parseSourcesManifest(readFileSync(MANIFEST_PATH, "utf8"));
const written: string[] = [];

for (const source of sources) {
  const from = `src/adapters/gen/${source.name}/endpoints.zod.ts`;

  if (!existsSync(from)) {
    continue;
  }

  const generated = readFileSync(from, "utf8");
  const limits = collectContractLimits(generated);
  const rendered = renderContractLimits(generated, limits);

  if (rendered === null) {
    continue;
  }

  const to = `src/adapters/gen/${source.name}/limits.ts`;

  writeFileSync(to, rendered, "utf8");
  written.push(`${to} (${limits.length} 件)`);
}

for (const line of written) {
  console.log(`  - ${line}`);
}

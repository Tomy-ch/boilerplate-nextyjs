#!/usr/bin/env node

// マーカー行の分布をベースラインへ書き出す入口。
//
// 検査そのものは `scan.test.ts` が行うので、ここは再生成だけを担う。人が更新できないゲートは、
// 赤を消すために検査のほうを外す圧力を生む。
//
//   pnpm exec tsx scripts/marker-baseline           差分を表示するだけ
//   pnpm exec tsx scripts/marker-baseline --write   ベースラインを現状で上書きする
import fs from "node:fs";

import { diffBaseline } from "./rules.js";
import {
  BASELINE_PATH,
  REPO_ROOT,
  readBaseline,
  scanRowsOutsideTable,
  scanTree,
} from "./scan.js";

const actual = scanTree(REPO_ROOT);

if (process.argv.includes("--write")) {
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(actual, null, 2)}\n`);
  console.log(`✓ marker-baseline: ${Object.keys(actual).length} ファイルで更新しました`);
  process.exit(0);
}

const failures = diffBaseline(actual, readBaseline());

// 行数の差分とは別の検査。ベースラインは「数が動いたら判断せよ」だが、こちらは 0 件が唯一の合格
// なので、`--write` では黙らせられない。
for (const [file, rows] of Object.entries(scanRowsOutsideTable(REPO_ROOT))) {
  failures.push(
    `表として成立していない行があります: ${file}（${rows.join(" / ")} 行目）` +
      " — 表の途中にブロックマーカーか空行が入っている。マーカーなら 1 行 1 実体にし、消える行は行内の `:line` で落とす",
  );
}

if (failures.length === 0) {
  console.log(`✓ marker-baseline: ${Object.keys(actual).length} ファイル、差分なし`);
  process.exit(0);
}

console.error(`✗ marker-baseline: ${failures.length} 件\n`);
for (const failure of failures) console.error(`  ${failure}`);
console.error("\n意図した変更なら: pnpm exec tsx scripts/marker-baseline --write");
process.exit(1);

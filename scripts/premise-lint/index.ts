#!/usr/bin/env node

// 残る文書に、その文書より先に失効する前提が書かれていないかを検査する入口。
//
// 規約は [`docs/rules.md`](../../docs/rules.md)「コメントと文書」が持ち、そこに**この検査へ移す**
// と書いてある —— それまでは純化パスの通過が肩代わりしており、あの機構は台帳が埋まると消える。
import fs from "node:fs";
import path from "node:path";

import { errorMessage } from "../lib/error-message.js";
import { findPremises, type Premise } from "./scan.js";
import { isScanned, SCANNED_PATHS } from "./targets.js";
import { UNCHECKED_SHAPES } from "./vocabulary.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

/** 走査から外すディレクトリ名。取得物と生成物。 */
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", ".next", "coverage", "dist", "tmp"]);

/** 走査対象の `.md` を集める。 */
function collect(relative: string): readonly string[] {
  const absolute = path.join(REPO_ROOT, relative);

  if (!fs.existsSync(absolute)) {
    return [];
  }

  if (fs.statSync(absolute).isFile()) {
    return isScanned(relative) ? [relative] : [];
  }

  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.isDirectory()) {
        return SKIPPED_DIRECTORIES.has(entry.name) ? [] : collect(path.join(relative, entry.name));
      }

      const child = path.join(relative, entry.name);

      return isScanned(child) ? [child] : [];
    })
    .sort();
}

function report(premises: readonly Premise[]): void {
  const byFile = new Map<string, Premise[]>();

  for (const premise of premises) {
    byFile.set(premise.file, [...(byFile.get(premise.file) ?? []), premise]);
  }

  for (const [file, found] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    console.error(`\n  ${file}`);

    for (const premise of found) {
      console.error(`    [${premise.shape}] \`${premise.phrase}\` —— ${premise.why}`);
      console.error(`      ${premise.text}`);
    }
  }
}

function main(): void {
  const files = SCANNED_PATHS.flatMap(collect);
  const premises = files.flatMap((file) =>
    findPremises(fs.readFileSync(path.join(REPO_ROOT, file), "utf8"), file),
  );

  // 検査していない形を毎回述べる。黙って通すと、緑が「前提なし」に読める
  // 。
  const note = `検査 ${files.length} 文書 / 未検査の形: ${UNCHECKED_SHAPES.join(" / ")}`;

  if (premises.length === 0) {
    console.log(`✓ premise-lint: ${note}`);

    return;
  }

  console.error(`✘ premise-lint: ${premises.length} 件の前提`);
  report(premises);
  console.error("\n  前提を書いてよいのは、前提と一緒に捨てられる文書（docs/get-started/）だけ。");
  console.error("  残る文書では、決定として書き直すか、剥がしのマーカーで囲う。");
  console.error(`\n  ${note}`);
  process.exit(1);
}

/* istanbul ignore next -- CLI entry。起動経路は pnpm lint:md が実地で通す。 */
try {
  main();
} catch (error) {
  console.error(`❌ ${errorMessage(error)}`);
  process.exit(1);
}

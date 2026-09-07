import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { KERNELS, type Kernel } from "../../architecture";
import { findBoundaryDrift, parseBoundaryFrontmatter } from "./readme-boundaries";

/**
 * 境界を宣言している README を、`src/` を辿って集める。
 *
 * @remarks
 * **カーネル直下だけを見ません。** 宣言はカーネルの下の階層にも置かれます（feature ごとにも
 * 同じ frontmatter を持つ README が要ります）。カーネル直下だけを突き合わせると、その下の宣言は
 * 誰も読まないまま `architecture.ts` から離れていきます。
 *
 * 属するカーネルは `src/` の直下のディレクトリ名で決まります。宣言の一覧を持たないのは、
 * 一覧の外へ宣言を書けてしまい、しかもその取りこぼしが無言だからです。
 */
function collectBoundaryReadmes(): { path: string; kernel: Kernel }[] {
  const found: { path: string; kernel: Kernel }[] = [];

  // 種別は `readdirSync` が返したものを使い、`statSync` で問い直さない。問い直すと
  // 「調べた時点」と「読む時点」が別々になり、その間に入れ替わったものを読む形になる。
  const walk = (directory: string, kernel: Kernel): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(path, kernel);
        continue;
      }

      if (entry.name !== "README.md") {
        continue;
      }

      if (readFileSync(path, "utf8").includes("\nimports-allowed:")) {
        found.push({ path, kernel });
      }
    }
  };

  for (const kernel of KERNELS) {
    const root = `src/${kernel}`;

    if (existsSync(root)) {
      walk(root, kernel);
    }
  }

  return found;
}

const failures: string[] = [];

for (const kernel of KERNELS) {
  if (!existsSync(`src/${kernel}/README.md`)) {
    failures.push(`src/${kernel}/README.md がありません`);
  }
}

const declarations = collectBoundaryReadmes();

for (const { path, kernel } of declarations) {
  try {
    const drift = findBoundaryDrift(kernel, parseBoundaryFrontmatter(readFileSync(path, "utf8")));

    for (const message of drift) {
      failures.push(`${path}: ${message}`);
    }
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error("❌ 層 README の境界宣言が architecture.ts と食い違っています:");

  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }

  process.exit(1);
}

console.log(`✅ ${declarations.length} 件の境界宣言が architecture.ts と一致しています`);

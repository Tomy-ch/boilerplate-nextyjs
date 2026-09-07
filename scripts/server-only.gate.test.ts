import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  findUnguardedServerModules,
  formatUnguardedServerModules,
  type ServerModule,
} from "./lib/server-only";

/**
 * server 専用と名乗った module が、client の束へ入ることを止める番人を持っているかのゲート。
 *
 * @remarks
 * 判定の中身は `lib/server-only.ts` が持ち、ここはツリーの走査だけを担う
 * （`client-schema-weight.gate.test.ts` と同形）。
 *
 * **境界検査は層の間しか見ておらず、server と client の区別を持たない。** 番人が抜けても、
 * その module を client から引く経路が今たまたま無ければ何も起きない。次に誰かが引いたときに
 * 初めて壊れ、そのときの失敗は引いた側の変更として現れる。
 */

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..");
const SOURCE_ROOT = join(REPOSITORY_ROOT, "src");

/** 走査から外す。テストは束に載らない。 */
const EXCLUDED = /\.test\.tsx?$/;

function collect(directory: string, into: ServerModule[]): ServerModule[] {
  // 種別を同じ走査から受け取る。名前だけ拾って改めて調べ直すと、その隙間に入れ替わったものを
  // 読むことになる。
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      collect(path, into);
      continue;
    }

    if (/\.tsx?$/.test(path) && !EXCLUDED.test(path)) {
      into.push({ path: relative(REPOSITORY_ROOT, path), content: readFileSync(path, "utf8") });
    }
  }

  return into;
}

describe("server 専用 module の番人", () => {
  // ----- 正常系 -----
  it("`*.server.ts` は import の先頭で `server-only` を引いている", () => {
    const modules = collect(SOURCE_ROOT, []);

    // 走査が空振りすると、違反ゼロを報告したままゲートが黙る。違反より先に「見た件数」を主張する。
    expect(modules.filter(({ path }) => /\.server\.tsx?$/.test(path)).length).toBeGreaterThan(0);
    expect(formatUnguardedServerModules(findUnguardedServerModules(modules))).toBe("");
  });
});

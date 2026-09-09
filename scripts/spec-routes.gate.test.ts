import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  findMissingScreenSpecs,
  findOrphanSpecs,
  NO_ROUTES_MESSAGE,
  SPEC_ROOT,
} from "./lib/spec-routes";

/**
 * route と仕様書の存在の突合ゲート。
 *
 * @remarks
 * 何を・なぜ見るかは [README](README.md) が挙げる「存在の突合」。写像と判定は
 * [`lib/spec-routes.ts`](lib/spec-routes.ts) が持ち、ここは木を歩くだけです。
 *
 * 剥がした木でも成立します —— サンプルの画面とその仕様書は同じ変更で消えるため、母数と対象が
 * 一緒に減ります。`strip-verify` / `purge-verify` の下でこのゲートが回るのはそのためです。
 */

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");

/** 母数の走査対象。 */
const APP_DIR = "src/app";

/** 仕様書のファイル名の末尾。この綴りだけで拾うので、配下に置いた README も仕様書として数える。 */
const SPEC_SUFFIX = ".md";

/** ディレクトリ配下のファイルを、リポジトリ相対のパスで列挙する。 */
function listFiles(relativeDir: string): string[] {
  const absolute = path.join(REPOSITORY_ROOT, relativeDir);

  if (!fs.existsSync(absolute)) {
    return [];
  }

  return fs
    .readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(REPOSITORY_ROOT, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    );
}

const appPaths = listFiles(APP_DIR);
const specPaths = listFiles(SPEC_ROOT).filter((file) => file.endsWith(SPEC_SUFFIX));

describe("route と仕様書の存在の突合", () => {
  // ----- 正常系 -----
  it("母数を 0 件へ縮退させない", () => {
    // 0 件のまま以降を通すと、検査が成立していないことと違反が無いことが同じ緑になる。
    expect(appPaths.length, NO_ROUTES_MESSAGE).toBeGreaterThan(0);
  });

  it("すべての route が画面要件を持つ", () => {
    expect(findMissingScreenSpecs(appPaths, specPaths)).toEqual([]);
  });

  it("route を持たない仕様書が無い", () => {
    expect(findOrphanSpecs(appPaths, specPaths)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { deferredChunks } from "./deferred";

describe("deferredChunks", () => {
  /** 綴りを中身へ写す、テストの中だけの成果物。 */
  const artifact = (files: Readonly<Record<string, string>>) => (chunk: string) =>
    files[chunk] ?? null;

  // ----- 正常系 -----
  it("初期の chunk が名指しする chunk を挙げる", () => {
    const found = deferredChunks(
      ["static/chunks/loader.js"],
      artifact({
        "static/chunks/loader.js": 'Promise.all(["static/chunks/lazy.js"].map(load))',
      }),
    );

    expect(found).toEqual(["static/chunks/lazy.js"]);
  });

  it("遅延の先が名指しする chunk まで辿る", () => {
    const found = deferredChunks(
      ["static/chunks/loader.js"],
      artifact({
        "static/chunks/loader.js": '"static/chunks/lazy.js"',
        "static/chunks/lazy.js": '"static/chunks/deeper.js"',
      }),
    );

    expect(found).toEqual(["static/chunks/lazy.js", "static/chunks/deeper.js"]);
  });

  it("遅延の先の stylesheet も挙げる", () => {
    const found = deferredChunks(
      ["static/chunks/loader.js"],
      artifact({ "static/chunks/loader.js": '"static/chunks/lazy.css"' }),
    );

    expect(found).toEqual(["static/chunks/lazy.css"]);
  });

  it("初期で読む chunk は遅延に数えない", () => {
    const found = deferredChunks(
      ["static/chunks/a.js", "static/chunks/b.js"],
      artifact({ "static/chunks/a.js": '"static/chunks/b.js"' }),
    );

    expect(found).toEqual([]);
  });

  it("互いを名指しする chunk でも止まる", () => {
    const found = deferredChunks(
      ["static/chunks/a.js"],
      artifact({
        "static/chunks/a.js": '"static/chunks/b.js"',
        "static/chunks/b.js": '"static/chunks/a.js""static/chunks/b.js"',
      }),
    );

    expect(found).toEqual(["static/chunks/b.js"]);
  });

  it("初期が空なら空を返す", () => {
    expect(deferredChunks([], () => '"static/chunks/lazy.js"')).toEqual([]);
  });

  it("名指しの綴りを持たない chunk からは何も出ない", () => {
    const found = deferredChunks(
      ["static/chunks/a.js"],
      artifact({ "static/chunks/a.js": "export const a = 1;" }),
    );

    expect(found).toEqual([]);
  });

  // ----- 異常系 -----
  // 成果物に在るはずの chunk が読めないのは、manifest と成果物の食い違いであって、
  // 契約が宣言した不在ではない。
  it("読めない chunk は辿らない", () => {
    expect(deferredChunks(["static/chunks/missing.js"], () => null)).toEqual([]);
  });
});

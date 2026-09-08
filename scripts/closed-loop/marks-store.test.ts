import { describe, expect, it } from "vitest";

import { collectWindows, toWorktreePaths, type MarksReader } from "./marks-store";

/** 作業ツリー → 窓 id → 打刻名 → 中身、を持つ作り物の読み手。 */
function readerOf(tree: Record<string, Record<string, Record<string, string>>>): MarksReader {
  return {
    listWindowIds: (root) => Object.keys(tree[root] ?? {}),
    readMark: (root, id, name) => tree[root]?.[id]?.[name] ?? null,
  };
}

describe("toWorktreePaths", () => {
  // ----- 正常系 -----
  it("worktree の行だけを読む", () => {
    const stdout = [
      "worktree /a",
      "HEAD abc",
      "branch refs/heads/x",
      "",
      "worktree /b",
      "bare",
    ].join("\n");

    expect(toWorktreePaths(stdout)).toEqual(["/a", "/b"]);
  });

  // ----- 異常系 -----
  it("知らない行が増えても 0 件へ縮退しない", () => {
    expect(toWorktreePaths(["未知の行", "worktree /a", "もっと未知の行"].join("\n"))).toEqual([
      "/a",
    ]);
  });

  it("空の出力を空にする", () => {
    expect(toWorktreePaths("")).toEqual([]);
  });

  it("パスが空の行を落とす", () => {
    expect(toWorktreePaths("worktree   \nworktree /a")).toEqual(["/a"]);
  });
});

describe("collectWindows", () => {
  // ----- 正常系 -----
  it("打刻を epoch の並びにする", () => {
    const windows = collectWindows(
      ["/a"],
      readerOf({ "/a": { "w2-x": { openedAt: "100\n", commitAt: "110\n120\n" } } }),
    );

    expect(windows).toEqual([{ id: "w2-x", marks: { openedAt: [100], commitAt: [110, 120] } }]);
  });

  it("作業ツリーを跨いで、開いた順に並べる", () => {
    const windows = collectWindows(
      ["/a", "/b"],
      readerOf({
        "/a": { "w2-x": { openedAt: "200" } },
        "/b": { "w1-y": { openedAt: "100" } },
      }),
    );

    expect(windows.map((window) => window.id)).toEqual(["w1-y", "w2-x"]);
  });

  it("知らない名前の打刻を読まない", () => {
    const windows = collectWindows(
      ["/a"],
      readerOf({ "/a": { "w1-x": { openedAt: "1", openedat: "2", 誤字: "3" } } }),
    );

    expect(windows[0]?.marks).toEqual({ openedAt: [1] });
  });

  // ----- 異常系 -----
  it("数として読めない行を落とす", () => {
    const windows = collectWindows(
      ["/a"],
      readerOf({ "/a": { "w1-x": { openedAt: "abc\n\n100" } } }),
    );

    expect(windows[0]?.marks).toEqual({ openedAt: [100] });
  });

  it("1 行も読めない打刻は無かったことにする", () => {
    const windows = collectWindows(["/a"], readerOf({ "/a": { "w1-x": { openedAt: "\n \n" } } }));

    expect(windows[0]?.marks).toEqual({});
  });

  it("窓が 1 つも無い作業ツリーを空にする", () => {
    expect(collectWindows(["/a", "/b"], readerOf({}))).toEqual([]);
  });
});

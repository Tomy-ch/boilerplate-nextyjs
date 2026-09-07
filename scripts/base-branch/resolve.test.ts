import { describe, expect, it } from "vitest";

import { NO_RELEASE_LINE_MESSAGE, selectLatestReleaseLine, unexpectedArguments } from "./resolve";

/** `git ls-remote --heads origin 'refs/heads/release/*'` の出力の形。 */
const LS_REMOTE_OUTPUT = [
  "9ce3aa244390610aafe2c2be564a757126c84e58\trefs/heads/release/v1.0.0",
  "88f39914c09eee7330c854f49b7b5d053d692f2d\trefs/heads/release/v2.1.0",
  "5741f714caa221bac8c3f4a315922934ed069864\trefs/heads/release/v2.2.0",
  "",
].join("\n");

describe("selectLatestReleaseLine", () => {
  // ----- 正常系 -----
  it("major / minor / patch を数値で比べて最新のブランチ名を返す", () => {
    expect(selectLatestReleaseLine(LS_REMOTE_OUTPUT)).toBe("release/v2.2.0");
  });

  it("文字列順では前に並ぶ二桁の版を最新と判定する", () => {
    const output = "a\trefs/heads/release/v1.9.0\nb\trefs/heads/release/v1.10.0\n";

    expect(selectLatestReleaseLine(output)).toBe("release/v1.10.0");
  });

  it("並び順が逆でも同じ答えを返す", () => {
    const output = "a\trefs/heads/release/v1.10.0\nb\trefs/heads/release/v1.9.0\n";

    expect(selectLatestReleaseLine(output)).toBe("release/v1.10.0");
  });

  it("末尾の改行が無くても、CRLF で終わっていても読む", () => {
    expect(selectLatestReleaseLine("a\trefs/heads/release/v1.0.0")).toBe("release/v1.0.0");
    expect(selectLatestReleaseLine("a\trefs/heads/release/v1.0.0\r\n")).toBe("release/v1.0.0");
  });

  it("1 本だけならそれを返す", () => {
    expect(selectLatestReleaseLine("a\trefs/heads/release/v0.1.0\n")).toBe("release/v0.1.0");
  });

  // ----- 異常系 -----
  it("リリースライン以外の参照を最新の判定に混ぜない", () => {
    const output = [
      "a\trefs/heads/hotfix/v9.9.9",
      "b\trefs/heads/release/next",
      "c\trefs/heads/release/v9.9.9-rc.1",
      "d\trefs/heads/release/v9.9.9/nested",
      "e\trefs/tags/release/v9.9.9",
      "refs/heads/release/v9.9.9",
      "f\trefs/heads/release/v1.0.0",
      "",
    ].join("\n");

    expect(selectLatestReleaseLine(output)).toBe("release/v1.0.0");
  });

  it("出力が空なら空文字を返さず投げる", () => {
    expect(() => selectLatestReleaseLine("")).toThrow(NO_RELEASE_LINE_MESSAGE);
  });

  it("解釈できる行が 1 つも無ければ投げる", () => {
    const output = "a\trefs/heads/feature/x\nb\trefs/heads/production\n";

    expect(() => selectLatestReleaseLine(output)).toThrow(NO_RELEASE_LINE_MESSAGE);
  });
});

describe("unexpectedArguments", () => {
  // ----- 正常系 -----
  it("引数が無ければ null を返す", () => {
    expect(unexpectedArguments([])).toBeNull();
  });

  // ----- 異常系 -----
  it("引数があれば黙って捨てずに、受け取った並びごと案内を返す", () => {
    expect(unexpectedArguments(["release/v1.0.0"])).toBe(
      "使い方: base-branch(引数は取りません): release/v1.0.0",
    );
  });

  it("フラグの形でも同じく断る", () => {
    expect(unexpectedArguments(["--bogus", "x"])).toBe(
      "使い方: base-branch(引数は取りません): --bogus x",
    );
  });
});

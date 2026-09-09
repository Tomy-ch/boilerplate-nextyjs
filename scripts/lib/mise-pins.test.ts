import { describe, expect, it } from "vitest";

import { pinId, readPins } from "./mise-pins";

const DECLARATION = `[settings]
pipx.uvx = true

[tools]
# ランタイム
"core:node" = "24.14.1"

# Lint
"aqua:rhysd/actionlint" = "1.7.12"
# 窓の内側で採る。
# tools-cooldown-ignore: 直前の版に脆弱性がある。
# 窓が明ける 2026-09-21 に外す。
"aqua:koalaman/shellcheck" = "0.11.0"
`;

describe("readPins", () => {
  // ----- 正常系 -----
  it("[tools] の pin を、書かれた順に行番号つきで読む", () => {
    expect(readPins(DECLARATION).map(({ key, version, line }) => ({ key, version, line }))).toEqual(
      [
        { key: "core:node", version: "24.14.1", line: 6 },
        { key: "aqua:rhysd/actionlint", version: "1.7.12", line: 9 },
        { key: "aqua:koalaman/shellcheck", version: "0.11.0", line: 13 },
      ],
    );
  });

  it("直上のコメント塊に宣言があれば、宣言の行から塊の末尾までを免除として読む", () => {
    const [, , shellcheck] = readPins(DECLARATION);

    expect(shellcheck?.ignore).toEqual({
      condition: "直前の版に脆弱性がある。 窓が明ける 2026-09-21 に外す。",
      line: 11,
    });
  });

  it("宣言より上の説明は免除に含めない", () => {
    const [, , shellcheck] = readPins(DECLARATION);

    expect(shellcheck?.ignore?.condition).not.toContain("窓の内側で採る");
  });

  it("宣言の無いコメント塊は免除にしない", () => {
    const [node, actionlint] = readPins(DECLARATION);

    expect(node?.ignore).toBeNull();
    expect(actionlint?.ignore).toBeNull();
  });

  it("空行で切れた上のコメントは、pin の塊として読まない", () => {
    const [pin] = readPins(`[tools]
# tools-cooldown-ignore: 2026-09-21 まで

"aqua:a/b" = "1.0.0"
`);

    expect(pin?.ignore).toBeNull();
  });

  it("[tools] の外の代入は pin として読まない", () => {
    expect(readPins(`[settings]\nfoo = "bar"\n[tools]\n"aqua:a/b" = "1.0.0"\n`)).toHaveLength(1);
  });

  it("引用符の無いキーも読む", () => {
    expect(readPins(`[tools]\nnode = "24.14.1"\n`)).toEqual([
      { key: "node", version: "24.14.1", line: 2, ignore: null },
    ]);
  });

  // ----- 異常系 -----
  it("[tools] が無ければ落とす", () => {
    expect(() => readPins(`[settings]\npipx.uvx = true\n`)).toThrow("[tools] テーブルがありません");
  });

  it("版が文字列でない pin は落とす", () => {
    expect(() => readPins(`[tools]\n"aqua:a/b" = { version = "1.0.0" }\n`)).toThrow(
      "aqua:a/b の版が文字列ではありません",
    );
  });

  it("見出しに行末コメントがあっても [tools] として読む", () => {
    expect(readPins(`[tools] # 固定する版\n"aqua:a/b" = "1.0.0"\n`)).toHaveLength(1);
  });

  it("生の行の代入をパーサの結果と突き合わせられなければ落とす", () => {
    // literal string のキーはパーサには `aqua:a/b` だが、行の読み方は引用符ごと拾う。
    expect(() => readPins(`[tools]\n'aqua:a/b' = "1.0.0"\n`)).toThrow(
      "2 行目の 'aqua:a/b' をパーサの結果と突き合わせられません",
    );
  });

  it("生の行から見つけた件数がパーサの件数と食い違えば落とす", () => {
    // 引用した見出し（`["tools"]`）はパーサには同じテーブルだが、行の読み方には掛からない。
    // 0 件へ縮退させると、全 pin が免除の無い pin として通る。
    expect(() => readPins(`["tools"]\n"aqua:a/b" = "1.0.0"\n`)).toThrow(
      "pin の件数が食い違います（パーサ 1 件 / 生の行 0 件）",
    );
  });
});

describe("pinId", () => {
  // ----- 正常系 -----
  it("キーと版を @ で繋ぐ", () => {
    expect(pinId({ key: "aqua:rhysd/actionlint", version: "1.7.12" })).toBe(
      "aqua:rhysd/actionlint@1.7.12",
    );
  });
});

import { describe, expect, it } from "vitest";

import { type IssueBody, missingRequiredFields, REQUIRED_HEADINGS } from "./required-fields";

function issue(overrides: Partial<IssueBody> = {}): IssueBody {
  return {
    number: 1,
    title: "[P1-1] 何かを作る",
    body: "### 目的\n\nあれ\n\n### 強制手段\n\nテスト\n\n### 完了条件\n\n緑",
    ...overrides,
  };
}

describe("missingRequiredFields", () => {
  // ----- 正常系 -----
  it("必須の見出しが揃っていれば何も返さない", () => {
    expect(missingRequiredFields([issue()])).toEqual([]);
  });

  it("欠けている見出しを、issue と組にして返す", () => {
    expect(
      missingRequiredFields([issue({ body: "### 目的\n\nあれ\n\n### 完了条件\n\n緑" })]),
    ).toEqual([{ number: 1, title: "[P1-1] 何かを作る", field: "強制手段" }]);
  });

  it("1 件が複数を欠けば、その数だけ返す", () => {
    expect(missingRequiredFields([issue({ body: "本文だけ" })])).toHaveLength(
      REQUIRED_HEADINGS.length,
    );
  });

  it("実装タスク以外は見ない。テンプレートが違えば必須も違う", () => {
    expect(
      missingRequiredFields([issue({ title: "[計画外] 何かを直す", body: "本文だけ" })]),
    ).toEqual([]);
  });

  it("issue が無ければ空を返す", () => {
    expect(missingRequiredFields([])).toEqual([]);
  });

  // ----- 異常系 -----
  it("見出しの綴りが違うものは、書かれていないものとして扱う", () => {
    // 「## 強制手段」（見出しの段が違う）はテンプレートが作る形ではない。
    expect(
      missingRequiredFields([issue({ body: "### 目的\n\n## 強制手段\n\n### 完了条件" })]),
    ).toEqual([{ number: 1, title: "[P1-1] 何かを作る", field: "強制手段" }]);
  });
});

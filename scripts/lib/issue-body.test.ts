import { describe, expect, it } from "vitest";

import { composeIssueBody, drawModelProse } from "./issue-body";

describe("composeIssueBody", () => {
  // ----- 正常系 -----
  it("閉じたフェンスを持つ authored を通す", () => {
    const body = composeIssueBody({
      evidence: { kind: "authored", text: "### 見出し\n\n```text\n道具の出力\n```" },
      note: "n",
    });

    expect(body).toBe("### 見出し\n\n```text\n道具の出力\n```\n\nn\n");
  });

  it("見出し・証拠・実行の URL・案内をこの順に空行で区切って並べる", () => {
    expect(
      composeIssueBody({
        heading: "落ちた内容:",
        evidence: { kind: "tool-output", text: "1 failed" },
        runUrl: "https://example.test/runs/1",
        note: "trace を開いてください。",
      }),
    ).toBe(
      "落ちた内容:\n\n    1 failed\n\n実行: https://example.test/runs/1\n\ntrace を開いてください。\n",
    );
  });

  it("道具の出力は空行も含めて字下げする", () => {
    expect(
      composeIssueBody({
        heading: "違反の詳細:",
        evidence: { kind: "tool-output", text: "color-contrast\n\nregion" },
        note: "rule を切らないでください。",
      }),
    ).toContain("    color-contrast\n    \n    region");
  });

  it("このリポジトリが組んだ証拠は字下げせず、markdown として描かせる", () => {
    expect(
      composeIssueBody({
        evidence: { kind: "authored", text: "| 画面 | LCP |\n| --- | --- |" },
        note: "予算を緩めないでください。",
      }),
    ).toBe("| 画面 | LCP |\n| --- | --- |\n\n予算を緩めないでください。\n");
  });

  it("見出しを持たない面では、証拠から始める", () => {
    expect(
      composeIssueBody({
        evidence: { kind: "authored", text: "表" },
        runUrl: "https://example.test/runs/2",
        note: "案内",
      }),
    ).toBe("表\n\n実行: https://example.test/runs/2\n\n案内\n");
  });

  it("実行を指さない面では、URL の行を置かない", () => {
    expect(
      composeIssueBody({
        evidence: { kind: "authored", text: "置き場の大きさ" },
        note: "make baseline-prune を実行してください。",
      }),
    ).toBe("置き場の大きさ\n\nmake baseline-prune を実行してください。\n");
  });

  it("モデルの散文は字下げせず、取り消せない記法だけを外して描く", () => {
    expect(
      composeIssueBody({
        evidence: { kind: "model-prose", text: "## 摩擦\n\n@octocat が指摘した" },
        note: "案内",
      }),
    ).toBe("## 摩擦\n\n`@octocat` が指摘した\n\n案内\n");
  });

  // ----- 異常系 -----
  it("開いたフェンスより短いフェンスでは閉じたことにしない", () => {
    expect(() =>
      composeIssueBody({
        evidence: { kind: "authored", text: "````text\n``` 中身 ```\n" },
        note: "n",
      }),
    ).toThrow(/閉じていないコードフェンス/);
  });

  it("記号の違うフェンスでは閉じたことにしない", () => {
    expect(() =>
      composeIssueBody({ evidence: { kind: "authored", text: "```text\n中身\n~~~" }, note: "n" }),
    ).toThrow(/閉じていないコードフェンス/);
  });

  it("閉じていないフェンスを持つ authored を弾く", () => {
    expect(() =>
      composeIssueBody({
        evidence: { kind: "authored", text: "### 見出し\n\n```text\n道具の出力" },
        note: "n",
      }),
    ).toThrow(/閉じていないコードフェンス/);
  });
});

describe("drawModelProse", () => {
  // ----- 正常系 -----
  it("散文と markdown の記法はそのまま残す", () => {
    expect(
      drawModelProse("## 摩擦\n\n- ゲートを 2 回回した（#12）\n\n`code` も **強調** も残る"),
    ).toBe("## 摩擦\n\n- ゲートを 2 回回した（#12）\n\n`code` も **強調** も残る");
  });

  it("mention をコードスパンへ入れて、名前は読めるまま通知だけ殺す", () => {
    expect(drawModelProse("@octocat と @some-user へ")).toBe("`@octocat` と `@some-user` へ");
  });

  it("PR への生のリンクも redirect.github.com へ寄せる", () => {
    expect(drawModelProse("https://github.com/vercel/next.js/pull/1 を見る")).toBe(
      "https://redirect.github.com/vercel/next.js/pull/1 を見る",
    );
  });

  it("他スレッドへの生のリンクを redirect.github.com へ寄せる", () => {
    expect(drawModelProse("https://github.com/vercel/next.js/issues/1 を見る")).toBe(
      "https://redirect.github.com/vercel/next.js/issues/1 を見る",
    );
  });

  // ----- 異常系 -----
  it("mention でないものを mention として囲まない", () => {
    expect(drawModelProse("a@example.test / `@octocat` / path/@scope")).toBe(
      "a@example.test / `@octocat` / path/@scope",
    );
  });

  it("スレッドを指さない GitHub の URL は寄せない", () => {
    expect(drawModelProse("https://github.com/o/r/commit/abc1234")).toBe(
      "https://github.com/o/r/commit/abc1234",
    );
  });
});

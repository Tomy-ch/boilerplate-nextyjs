import { describe, expect, it } from "vitest";

import { renderDigest, renderExpired, renderIssueBody } from "./report";
import type { ExpiredSuppression, Suppression } from "./rules";

const SUPPRESSION: Suppression = {
  source: "osv-scanner.toml",
  subject: "GHSA-1111",
  condition: "2026-08-02 以降に削除する。",
};

const EXPIRED: ExpiredSuppression = { ...SUPPRESSION, dueDate: "2026-08-02" };

describe("renderDigest", () => {
  // ----- 正常系 -----
  it("面・対象・条件を 1 行ずつ並べる", () => {
    expect(renderDigest([SUPPRESSION])).toBe(
      "osv-scanner.toml\tGHSA-1111\t2026-08-02 以降に削除する。",
    );
  });

  it("宣言が無ければ空を返す", () => {
    expect(renderDigest([])).toBe("");
  });
});

describe("renderExpired", () => {
  // ----- 正常系 -----
  it("面・対象・期限を並べる", () => {
    expect(renderExpired([EXPIRED])).toBe("osv-scanner.toml の GHSA-1111（期限 2026-08-02）");
  });

  it("満たしたものが無ければ空を返す", () => {
    expect(renderExpired([])).toBe("");
  });
});

describe("renderIssueBody", () => {
  // ----- 正常系 -----
  it("条件の散文を、記法として描かせない", () => {
    // 条件はこのリポジトリが書いたものではない。素の markdown で描くと mention や偽リンクが
    // CI の名義で公開の issue に載る。
    const body = renderIssueBody({
      expired: [EXPIRED],
      suppressions: [{ ...SUPPRESSION, condition: "[緊急](https://evil.example/login) @team" }],
      commentBorneSources: [".github/zizmor.yml"],
    });

    // 行頭に来ない位置を見ても意味が無い。字下げが入っているかどうかで弁別する。
    expect(body).toContain("    osv-scanner.toml\tGHSA-1111\t[緊急](https://evil.example/login)");
  });

  it("満たした件数を見出しに出す", () => {
    const body = renderIssueBody({
      expired: [EXPIRED],
      suppressions: [SUPPRESSION],
      commentBorneSources: [],
    });

    expect(body).toContain("1 件が撤回条件を満たしています。");
  });

  it("満たしたものが無ければ、その旨を見出しに出す", () => {
    const body = renderIssueBody({
      expired: [],
      suppressions: [SUPPRESSION],
      commentBorneSources: [],
    });

    expect(body).toContain("撤回条件を満たした宣言はありません。");
  });

  it("宣言単位では読めない面を、本文で名指しする", () => {
    // 見えていない範囲を書かないと、この報告が全件を見たものとして読まれる。
    const body = renderIssueBody({
      expired: [],
      suppressions: [SUPPRESSION],
      commentBorneSources: [".gitleaks.toml", ".github/zizmor.yml"],
    });

    expect(body).toContain(".gitleaks.toml / .github/zizmor.yml");
  });

  it("実行の URL を渡さなければ、実行の行を出さない", () => {
    // 常に渡す実装へ戻しても、渡した側のケースだけでは落ちない。
    const body = renderIssueBody({
      expired: [],
      suppressions: [SUPPRESSION],
      commentBorneSources: [],
    });

    expect(body).not.toMatch(/^実行: /m);
  });

  it("実行の URL を渡せば本文に載せる", () => {
    const body = renderIssueBody({
      expired: [],
      suppressions: [SUPPRESSION],
      commentBorneSources: [],
      runUrl: "https://github.test/run/1",
    });

    expect(body).toContain("https://github.test/run/1");
  });
});

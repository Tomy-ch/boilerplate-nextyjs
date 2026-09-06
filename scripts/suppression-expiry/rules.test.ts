import { describe, expect, it } from "vitest";

import { expiredSuppressions, type Suppression } from "./rules";

function suppression(condition: string): Suppression {
  return { source: "osv-scanner.toml", subject: "GHSA-0000-0000-0000", condition };
}

describe("expiredSuppressions", () => {
  // ----- 正常系 -----
  it("期限が基準日より前なら、撤回してよいと答える", () => {
    expect(expiredSuppressions([suppression("2026-08-02 以降に削除する")], "2026-09-06")).toEqual([
      {
        source: "osv-scanner.toml",
        subject: "GHSA-0000-0000-0000",
        condition: "2026-08-02 以降に削除する",
        dueDate: "2026-08-02",
      },
    ]);
  });

  it("期限が基準日と同じ日なら、撤回してよいと答える", () => {
    expect(expiredSuppressions([suppression("2026-09-06 以降に削除する")], "2026-09-06")).toEqual([
      {
        source: "osv-scanner.toml",
        subject: "GHSA-0000-0000-0000",
        condition: "2026-09-06 以降に削除する",
        dueDate: "2026-09-06",
      },
    ]);
  });

  it("期限がまだ来ていなければ答えない", () => {
    expect(expiredSuppressions([suppression("2026-09-30 以降に削除する")], "2026-09-06")).toEqual(
      [],
    );
  });

  it("日付が複数あれば、最も遅いものを期限として読む", () => {
    expect(
      expiredSuppressions(
        [suppression("2026-08-29 公開。冷却が明ける 2026-09-05 以降")],
        "2026-09-01",
      ),
    ).toEqual([]);
  });

  it("日付が本文の中で時系列と逆に書かれていても、値として最も遅いものを期限にする", () => {
    // 出現順の最後を取る実装は、ここで早い側（2026-08-02）を期限に選び、来ていない期限を
    // 過ぎたと報告する。
    expect(
      expiredSuppressions(
        [suppression("2026-09-05 以降に削除する（当初は 2026-08-02 の予定だった）")],
        "2026-08-15",
      ),
    ).toEqual([]);
  });

  it("宣言が無ければ空を返す", () => {
    expect(expiredSuppressions([], "2026-09-06")).toEqual([]);
  });

  // ----- 異常系 -----
  it("日付を持たない条件は、満たされたと判定しない", () => {
    expect(
      expiredSuppressions(
        [suppression("Storybook が image-size を引かなくなった時点で削除する")],
        "2026-09-06",
      ),
    ).toEqual([]);
  });
});

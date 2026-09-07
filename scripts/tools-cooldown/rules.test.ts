import { describe, expect, it } from "vitest";

import type { MisePin } from "../lib/mise-pins";
import type { Route } from "./published";
import { addedPins, judgePin, parseWindows, type Windows } from "./rules";

const WINDOWS: Windows = { "github-release": 14, registry: 7 };

const GITHUB_RELEASE: Route = { kind: "channel", channel: "github-release" };
const REGISTRY: Route = { kind: "channel", channel: "registry" };
const EXCLUDED: Route = { kind: "excluded" };
const NONE: Route = { kind: "none" };

/** 判定の基準時刻。窓の境界を暦日で踏むため、日本時間の正午に置く。 */
const NOW = new Date("2026-09-08T03:00:00Z");

function pin(overrides: Partial<MisePin> = {}): MisePin {
  return {
    key: "aqua:owner/repo",
    version: "1.0.0",
    line: 10,
    ignore: null,
    ...overrides,
  };
}

/** 現在から `days` 日前の時刻。 */
function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

describe("addedPins", () => {
  // ----- 正常系 -----
  it("base に無いキーと、版が動いたキーを選ぶ", () => {
    const base = [pin(), pin({ key: "aqua:a/b", version: "2.0.0" })];
    const current = [
      pin(),
      pin({ key: "aqua:a/b", version: "2.1.0" }),
      pin({ key: "pipx:new", version: "0.1.0" }),
    ];

    expect(addedPins(base, current).map((entry) => `${entry.key}@${entry.version}`)).toEqual([
      "aqua:a/b@2.1.0",
      "pipx:new@0.1.0",
    ]);
  });

  it("何も動いていなければ空を返す", () => {
    expect(addedPins([pin()], [pin()])).toEqual([]);
  });
});

describe("parseWindows", () => {
  // ----- 正常系 -----
  it("2 つの経路の窓を読む", () => {
    expect(
      parseWindows(
        new Map([
          ["release-days", "14"],
          ["registry-days", "7"],
        ]),
      ),
    ).toEqual(WINDOWS);
  });

  it("0 日も窓として読む（検疫を切る指定）", () => {
    expect(
      parseWindows(
        new Map([
          ["release-days", "0"],
          ["registry-days", "0"],
        ]),
      ),
    ).toEqual({ "github-release": 0, registry: 0 });
  });

  // ----- 異常系 -----
  it("経路の窓が 1 つでも無ければ落とす。既定へ倒すとその経路の検疫が消える", () => {
    expect(() => parseWindows(new Map([["release-days", "14"]]))).toThrow(
      "--registry-days に非負の整数を渡してください",
    );
  });

  it("整数でない窓は落とす", () => {
    expect(() =>
      parseWindows(
        new Map([
          ["release-days", "14"],
          ["registry-days", "-1"],
        ]),
      ),
    ).toThrow("--registry-days に非負の整数を渡してください");
  });
});

describe("judgePin", () => {
  // ----- 正常系 -----
  it("窓を満たした pin は clear", () => {
    const judgement = judgePin(
      pin(),
      GITHUB_RELEASE,
      { kind: "published", at: daysAgo(14) },
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("clear");
    expect(judgement.message).toBe("公開 2026-08-25、経過 14 日（窓 14 日）");
  });

  it("窓は経路ごとに当てる。レジストリの 7 日を満たせば GitHub の 14 日は要らない", () => {
    const judgement = judgePin(
      pin({ key: "pipx:tool" }),
      REGISTRY,
      { kind: "published", at: daysAgo(7) },
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("clear");
  });

  it("窓の内側でも、日付が窓明け以降の免除があれば exempt", () => {
    const judgement = judgePin(
      pin({ ignore: { condition: "直前の版に脆弱性。2026-09-21 に外す。", line: 9 } }),
      GITHUB_RELEASE,
      { kind: "published", at: daysAgo(3) },
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("exempt");
    expect(judgement.message).toBe(
      "窓の内側（公開 2026-09-05、経過 3 日）ですが免除があります（期限 2026-09-21）: 直前の版に脆弱性。2026-09-21 に外す。",
    );
  });

  it("免除の期限が窓の明ける日と同じ日なら exempt", () => {
    const judgement = judgePin(
      pin({ ignore: { condition: "2026-09-19 に外す。", line: 9 } }),
      GITHUB_RELEASE,
      { kind: "published", at: daysAgo(3) },
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("exempt");
  });

  it("窓の対象外の pin は excluded。公開日時が窓の内側でも違反にならず、未解決にもならない", () => {
    const judgement = judgePin(
      pin({ key: "core:node", version: "24.14.1" }),
      EXCLUDED,
      { kind: "published", at: daysAgo(0) },
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("excluded");
    expect(judgement.message).toBe("言語ランタイムは窓の対象外（受容するリスク）");
  });

  it("窓の対象外の pin は公開日時を引いていなくても excluded。引けない（unresolved）とは別の出口", () => {
    const judgement = judgePin(pin({ key: "core:python" }), EXCLUDED, null, WINDOWS, NOW);

    expect(judgement.verdict).toBe("excluded");
  });

  // ----- 異常系 -----
  it("窓の内側で免除が無ければ violation。窓明けの日と免除の書き方を案内する", () => {
    const judgement = judgePin(
      pin(),
      GITHUB_RELEASE,
      { kind: "published", at: daysAgo(13) },
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("violation");
    expect(judgement.message).toBe(
      "公開 2026-08-26 から 13 日で、窓（14 日）の内側です。2026-09-09 以降に上げるか、pin の直上に「# tools-cooldown-ignore: <理由>。2026-09-09 に外す」を置いてください",
    );
  });

  it("免除に日付が無ければ violation", () => {
    const judgement = judgePin(
      pin({ ignore: { condition: "上流が直したら外す。", line: 9 } }),
      GITHUB_RELEASE,
      { kind: "published", at: daysAgo(3) },
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("violation");
    expect(judgement.message).toBe(
      "免除に日付がありません。窓が明ける 2026-09-19 を撤回の日として書いてください",
    );
  });

  it("免除の期限が窓の明ける日より前なら violation。免除が窓の途中で失効する", () => {
    const judgement = judgePin(
      pin({ ignore: { condition: "2026-09-10 に外す。", line: 9 } }),
      GITHUB_RELEASE,
      { kind: "published", at: daysAgo(3) },
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("violation");
    expect(judgement.message).toBe(
      "免除の期限 2026-09-10 が窓の明ける 2026-09-19 より前です。期限を 2026-09-19 以降にしてください",
    );
  });

  it("窓を満たした pin に免除が残っていれば violation。撤回条件を満たした宣言である", () => {
    const judgement = judgePin(
      pin({ ignore: { condition: "2026-09-01 に外す。", line: 9 } }),
      GITHUB_RELEASE,
      { kind: "published", at: daysAgo(30) },
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("violation");
    expect(judgement.message).toBe(
      "窓を満たしている（公開 2026-08-09、経過 30 日）のに免除が残っています。9 行目の免除を外してください",
    );
  });

  it("窓の対象外の pin に免除があれば violation。効かない宣言である", () => {
    const judgement = judgePin(
      pin({ key: "core:node", ignore: { condition: "2026-09-21 に外す。", line: 9 } }),
      EXCLUDED,
      null,
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("violation");
    expect(judgement.message).toBe(
      "窓の対象外の pin に免除があります。9 行目の免除を外してください",
    );
  });

  it("経路を持たない backend は unresolved。検査できていない", () => {
    const judgement = judgePin(pin({ key: "go:github.com/x/y" }), NONE, null, WINDOWS, NOW);

    expect(judgement.verdict).toBe("unresolved");
    expect(judgement.message).toBe(
      "go:github.com/x/y の backend は公開日時を引く経路を持ちません（検査できません）",
    );
  });

  it("経路を持つ pin の公開日時を引いていなければ unresolved", () => {
    const judgement = judgePin(pin(), GITHUB_RELEASE, null, WINDOWS, NOW);

    expect(judgement.verdict).toBe("unresolved");
    expect(judgement.message).toBe("公開日時を引いていません");
  });

  it("公開日時を引けなければ unresolved。古いとも新しいとも判定しない", () => {
    const judgement = judgePin(
      pin(),
      GITHUB_RELEASE,
      { kind: "failed", reason: "HTTP 403" },
      WINDOWS,
      NOW,
    );

    expect(judgement.verdict).toBe("unresolved");
    expect(judgement.message).toBe("公開日時を引けません: HTTP 403");
  });
});

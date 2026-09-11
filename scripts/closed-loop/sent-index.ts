// どの窓を送出済みかを覚える索引の判定。読み書きは入口([send/index.ts](send/index.ts))が持つ。
//
// 置き場は `.agents/private/`（追跡外）である —— 失っても費用は「同じ窓をもう一度立てる」
// だけで、コミットすると別のマシンでそれが正を主張する
// 。

import { isSubstantive, markAt, type WindowMarks } from "./phases.js";

export type SentEntry = {
  readonly windowId: string;
  readonly issue: number;
  readonly sentAt: number;
};

/** 索引全体。窓 id を鍵にする。 */
export type SentIndex = {
  readonly entries: readonly SentEntry[];
};

const EMPTY: SentIndex = { entries: [] };

/**
 * 索引を解析する。
 *
 * @remarks
 * **読めない索引は空として扱います。**壊れた索引で落とすと、以後どの窓も送れなくなります ——
 * 索引を失う費用は同じ窓をもう一度立てることだけで、止まる費用のほうが高い。形の合わない
 * 項目は 1 件ずつ落とし、残りは活かします。
 */
export function parseSent(raw: unknown): SentIndex {
  if (typeof raw !== "object" || raw === null) {
    return EMPTY;
  }

  const entries = (raw as { entries?: unknown }).entries;

  if (!Array.isArray(entries)) {
    return EMPTY;
  }

  return {
    entries: entries.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return [];
      }

      const { windowId, issue, sentAt } = entry as Record<string, unknown>;

      if (typeof windowId !== "string" || typeof issue !== "number") {
        return [];
      }

      return [{ windowId, issue, sentAt: typeof sentAt === "number" ? sentAt : 0 }];
    }),
  };
}

/**
 * まだ送っていない、送出に値する窓。
 *
 * @remarks
 * 通すのは 3 つを満たす窓だけです —— **閉じている**（半分の窓は遅れた窓より悪い）、
 * **段の境界を越えている**（`isSubstantive`）、**索引に無い**。
 *
 * 索引に無いことを「送っていない」と読むのは、**送出が索引の書き込みより先**だからです。
 * 逆にすると、投稿に失敗した窓が送出済みとして残ります。この向きだと最悪でも同じ窓が
 * 二度立ち、それは題の窓 id で人が気づけます。
 */
export function unsent(windows: readonly WindowMarks[], index: SentIndex): readonly WindowMarks[] {
  const known = new Set(index.entries.map((entry) => entry.windowId));

  return windows.filter(
    (window) =>
      markAt(window, "closedAt") !== null && isSubstantive(window) && !known.has(window.id),
  );
}

/** 送出済みを 1 件足す。同じ窓が既に在れば置き換える。 */
export function withSent(index: SentIndex, entry: SentEntry): SentIndex {
  return {
    entries: [...index.entries.filter((e) => e.windowId !== entry.windowId), entry],
  };
}

// セッションの記録から、数えるだけで決まる事実を出す判定。記録の形を知っているのは
// [events.ts](events.ts) で、ここはその出来事の列を数えるだけである。
//
// なぜ記録を読むのか、どこまでを読んでよいのかは
// [0160](../../docs/adr/0160-agent-environment-loop.md) 決定 5 が持つ。**打刻が第一で、これは補完**
// である（[0161](../../docs/adr/0161-development-window-as-feedback-unit.md)）。
//
// ここが出すのは**数**だけで、解釈はしない。「何が難しかったか」は数からは出ない。

import type { Event } from "./events.js";

/**
 * 作業ツリーのパスから、その記録の置き場の名前を導く。
 *
 * @remarks
 * 綴り換えの規則を決めているのはツールです。区切りだけを置き換えると `.claude/` の下に置いた
 * 作業ツリーを取り落とすので、**名前に使えない文字をすべて `-` にします** —— 規則が変わっても
 * 取りこぼしではなく空振りとして現れる側に倒しています。
 */
export function toProjectSlug(root: string): string {
  return root.replace(/[^A-Za-z0-9-]/g, "-");
}

/** 記録から数えた事実。どれも解釈を含まない。 */
export type TranscriptCounts = {
  /** `/<名前>` の起動回数。名前ごと。ツールの組み込みも混ざる */
  readonly commands: Readonly<Record<string, number>>;
  /** 道具の使用回数。名前ごと */
  readonly tools: Readonly<Record<string, number>>;
  /** 道具が失敗を返した回数 */
  readonly toolErrors: number;
  /** 人が実行を中断した回数 */
  readonly interruptions: number;
  /** やり取りの数（人とモデルの発話） */
  readonly turns: number;
  /** 最初と最後の時刻（epoch 秒）。窓との突き合わせに使う */
  readonly firstAt: number | null;
  readonly lastAt: number | null;
};

/** その種別の出来事を、名前ごとに数える。名前を持たない出来事は数えない。 */
function countNames(
  events: readonly Event[],
  kind: Event["kind"],
): Readonly<Record<string, number>> {
  const counter: Record<string, number> = {};

  for (const event of events) {
    if (event.kind === kind && event.name !== undefined) {
      counter[event.name] = (counter[event.name] ?? 0) + 1;
    }
  }

  return counter;
}

/**
 * 記録が覆う時刻の幅。
 *
 * @remarks
 * 時刻を持たない出来事（`at` が 0）は数えません。記録の側に時刻が無いだけで、その出来事が
 * 1970 年に起きたわけではないためです。
 */
function spanOf(events: readonly Event[]): {
  readonly firstAt: number | null;
  readonly lastAt: number | null;
} {
  const stamps = events.map((event) => event.at).filter((at) => at > 0);

  return stamps.length === 0
    ? { firstAt: null, lastAt: null }
    : { firstAt: Math.min(...stamps), lastAt: Math.max(...stamps) };
}

/**
 * 出来事の列を数える。
 *
 * @remarks
 * 数える対象を出来事に取るのは、**同じ列を読ませる候補の選定も読むから**です。数え方と
 * 選び方が別々に記録を解釈すると、報告の数と読解の材料が食い違っても誰も気づけません。
 *
 * 指標ごとに列を歩き直します。1 度の走査へ畳むと、どの指標がどの出来事を数えるかが
 * 分岐の入れ子の中に沈み、指標を 1 つ足すたびにその入れ子を読む必要が出ます。
 */
export function countEvents(events: readonly Event[]): TranscriptCounts {
  return {
    commands: countNames(events, "command"),
    tools: countNames(events, "tool_use"),
    toolErrors: events.filter((event) => event.kind === "tool_result" && event.ok === false).length,
    interruptions: events.filter((event) => event.kind === "interrupt").length,
    turns: events.filter((event) => event.kind === "prompt" || event.kind === "assistant").length,
    ...spanOf(events),
  };
}

/**
 * 宣言されたスキルのうち、記録に 1 度も現れなかったもの。
 *
 * @remarks
 * **これは退役の根拠ではない**（[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 3）。
 * 機会を待つスキルは、機会が来なかった期間について何も語りません。判定は利用の型に対して行い、
 * ここが返すのは**その判定の入力**です。
 */
export function neverInvoked(
  declared: readonly string[],
  counts: TranscriptCounts,
): readonly string[] {
  return declared.filter((name) => (counts.commands[name] ?? 0) === 0);
}

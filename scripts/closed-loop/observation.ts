// 1 つの窓について決定的に数えた値と、それを issue 本文へ書き出す / 読み戻す判定。
//
// 週次([weekly](weekly/index.ts))は自分で記録を読み直さず、**issue に書かれた観測を読み戻す**。
// 記録は手元にしか無く、週次が動く時点では別の窓の別の機械かもしれないためである
// （[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 5）。
//
// だから本文には**人が読む表と、機械が読む区画の両方**が要る。同じ値から両方を作るので、
// 食い違いようがない。

import { markAt, toPhases, type WindowMarks } from "./phases.js";
import type { TranscriptCounts } from "./transcript.js";

/** 段の区間 1 つ。 */
export type ObservedPhase = {
  readonly from: string;
  readonly to: string;
  readonly sec: number;
};

/**
 * 1 つの窓について数えた値。
 *
 * @remarks
 * 記録から数えた項目は `undefined` を取ります。**「観測できなかった」を `0` と混ぜません** ——
 * 記録が読めなかった窓の失敗 0 件と、実際に失敗しなかった窓の 0 件は別の事実です
 * （[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。
 */
export type Observation = {
  readonly windowId: string;
  readonly openedAt: number | null;
  readonly closedAt: number | null;
  readonly phases: readonly ObservedPhase[];
  readonly prompts?: number;
  readonly toolCalls?: number;
  readonly toolFailures?: number;
  readonly interrupts?: number;
};

const BLOCK_START = "```yaml closed-loop";
const FENCE = "```";

/** 道具の呼び出し回数の合計。 */
function totalToolCalls(counts: TranscriptCounts): number {
  return Object.values(counts.tools).reduce((sum, count) => sum + count, 0);
}

/**
 * 窓と、その時間帯の記録から観測を作る。
 *
 * @param counts - 窓の時間帯に絞った数。記録を読めなかったときは `undefined`
 */
export function toObservation(
  window: WindowMarks,
  counts: TranscriptCounts | undefined,
): Observation {
  return {
    windowId: window.id,
    openedAt: markAt(window, "openedAt"),
    closedAt: markAt(window, "closedAt"),
    phases: toPhases(window).map((phase) => ({
      from: phase.from,
      to: phase.to,
      sec: phase.seconds,
    })),
    ...(counts === undefined
      ? {}
      : {
          prompts: counts.turns,
          toolCalls: totalToolCalls(counts),
          toolFailures: counts.toolErrors,
          interrupts: counts.interruptions,
        }),
  };
}

/**
 * 観測を、機械が読み戻せる区画にする。
 *
 * @remarks
 * `undefined` の項目は書きません。**空欄が「観測できなかった」を表し、`0` と区別されます。**
 * 依存を増やさないよう、値が数と文字列に限られることを前提に手で組み立てます。
 */
export function renderObservation(observation: Observation): string {
  const lines = [BLOCK_START, `windowId: ${observation.windowId}`];

  if (observation.openedAt !== null) {
    lines.push(`openedAt: ${observation.openedAt}`);
  }

  if (observation.closedAt !== null) {
    lines.push(`closedAt: ${observation.closedAt}`);
  }

  for (const [key, value] of [
    ["prompts", observation.prompts],
    ["toolCalls", observation.toolCalls],
    ["toolFailures", observation.toolFailures],
    ["interrupts", observation.interrupts],
  ] as const) {
    if (value !== undefined) {
      lines.push(`${key}: ${value}`);
    }
  }

  if (observation.phases.length > 0) {
    lines.push("phases:");

    for (const phase of observation.phases) {
      lines.push(`  - from: ${phase.from}`, `    to: ${phase.to}`, `    sec: ${phase.sec}`);
    }
  }

  lines.push(FENCE);

  return lines.join("\n");
}

/** 数として読める行の値。読めなければ undefined。 */
function numberOf(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const value = Number.parseInt(raw.trim(), 10);

  return Number.isFinite(value) ? value : undefined;
}

/**
 * issue 本文から観測を読み戻す。
 *
 * @remarks
 * **区画が無い、あるいは窓 ID が読めない本文は `undefined` を返します。**人が書き換えた本文や、
 * 別の目的で立った issue を観測として数えると、週次のスコアが観測でないもので動きます。
 *
 * 自前で読むのは、依存を 1 つ増やさないためです。書く側と読む側が同じファイルに居るので、
 * 形が変わればここも一緒に変わります。
 */
export function parseObservation(body: string): Observation | undefined {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim() === BLOCK_START);

  if (start < 0) {
    return undefined;
  }

  const end = lines.findIndex((line, index) => index > start && line.trim() === FENCE);
  const block = lines.slice(start + 1, end < 0 ? lines.length : end);
  const scalars = new Map<string, string>();
  const phases: ObservedPhase[] = [];
  let phase: Partial<ObservedPhase> = {};

  for (const line of block) {
    const item = /^\s*-\s+from:\s*(.+?)\s*$/.exec(line);

    if (item !== null) {
      phase = { from: item[1] };

      continue;
    }

    const nested = /^\s+(to|sec):\s*(.+?)\s*$/.exec(line);

    if (nested !== null) {
      if (nested[1] === "to") {
        phase = { ...phase, to: nested[2] };
      } else {
        phase = { ...phase, sec: numberOf(nested[2]) };
      }

      if (phase.from !== undefined && phase.to !== undefined && phase.sec !== undefined) {
        phases.push({ from: phase.from, to: phase.to, sec: phase.sec });
        phase = {};
      }

      continue;
    }

    const scalar = /^([A-Za-z]+):\s*(.*)$/.exec(line);

    if (scalar !== null && scalar[1] !== undefined) {
      scalars.set(scalar[1], scalar[2] ?? "");
    }
  }

  const windowId = scalars.get("windowId")?.trim();

  if (windowId === undefined || windowId === "") {
    return undefined;
  }

  return {
    windowId,
    openedAt: numberOf(scalars.get("openedAt")) ?? null,
    closedAt: numberOf(scalars.get("closedAt")) ?? null,
    phases,
    ...defined("prompts", numberOf(scalars.get("prompts"))),
    ...defined("toolCalls", numberOf(scalars.get("toolCalls"))),
    ...defined("toolFailures", numberOf(scalars.get("toolFailures"))),
    ...defined("interrupts", numberOf(scalars.get("interrupts"))),
  };
}

/** 値が在るときだけ鍵を作る。無い鍵と `undefined` の鍵を同じにする。 */
function defined(key: string, value: number | undefined): Record<string, number> {
  return value === undefined ? {} : { [key]: value };
}

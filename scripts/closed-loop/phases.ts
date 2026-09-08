// 打刻から段の区間と異常を導く判定。ファイルの読み取りは入口([index.ts](index.ts))が持ち、
// ここは受け取った打刻だけから答えを出す。
//
// 何を測るのかは [0160](../../docs/adr/0160-agent-environment-loop.md)、単位が窓であることと
// 打刻が第一であることは [0161](../../docs/adr/0161-development-window-as-feedback-unit.md) が持つ。

/** 1 つの窓の打刻。名前ごとに、追記された epoch(秒)の並び。 */
export type WindowMarks = {
  readonly id: string;
  readonly marks: Readonly<Record<string, readonly number[]>>;
};

/** 段の区間。`from` から `to` までの実測。 */
export type Phase = {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly seconds: number;
};

/** 窓についての所見。どれも打刻だけから決まる。 */
export type Anomaly = {
  readonly kind: "順序が逆" | "段が飛んでいる" | "窓が開いたまま" | "打刻が開始だけ";
  readonly detail: string;
};

/**
 * 打刻が並ぶべき順序。
 *
 * @remarks
 * 区間はこの並びの**隣り合う打刻のうち、実際に在るもの同士**で作ります。存在しない打刻を
 * 埋めないのは、[0161](../../docs/adr/0161-development-window-as-feedback-unit.md) の
 * 「刻まれなければ存在しない」に従うためです。推測で埋めると、測っていない区間が
 * 測った区間と同じ見た目で並びます。
 */
export const MARK_ORDER: readonly string[] = [
  "openedAt",
  "planApprovedAt",
  "implStartedAt",
  "commitAt",
  "reviewStartedAt",
  "prOpenedAt",
  "mergedAt",
  "closedAt",
];

/**
 * 刻まれなくても所見にしない段。
 *
 * @remarks
 * この 2 つを刻むのは計画から実装へ渡る段だけで、**その段を持たない窓では起き得ません** ——
 * コミットもレビューも PR も、それぞれ別の入口が刻みます。起き得ない段の不在を「飛んだ」と
 * 呼ぶと、正常な窓のほとんどが所見を持ち、本当に飛んだ窓がその中に埋もれます。
 * ここに並ぶのは「無いことが正常な段」であって、「測っていない段」ではありません。
 */
const OPTIONAL_MARKS: readonly string[] = ["planApprovedAt", "implStartedAt"];

/**
 * 回数として意味を持つ打刻。
 *
 * @remarks
 * 打刻はイベントの列なので、回数もそのまま所見になります —— `commitAt` の回数はその窓の
 * コミット数、`reviewStartedAt` の回数はレビューを回した回数です。**窓の開閉は数えません**。
 * 1 回であることが決まっており、数が所見にならないためです。
 */
export const COUNTED_MARKS: readonly string[] = ["commitAt", "reviewStartedAt"];

/**
 * 窓が 1 つも挙がらなかったときに出す行。
 *
 * @remarks
 * 打刻の置き場が空であることと、走査が壊れて 0 件になったことは見分けが付きません。
 * そのまま「異常なし」を返すと、**壊れた集計が永久に緑を返します**
 * ([0157](../../docs/adr/0157-inspection-declaration-discipline.md))。
 */
export const NO_WINDOWS_MESSAGE =
  "窓が 1 件もありません。まだ打刻されていないか、走査の対象が動いた可能性があります";

/**
 * その打刻が最初に刻まれた時刻。無ければ null。
 *
 * @remarks
 * 繰り返し刻まれた打刻でも**最初の 1 つ**を返します。段の境界を越えた時刻はその 1 回目で、
 * 2 回目以降は同じ段の中の出来事です。何回刻まれたかは `countOf` が持ちます。
 */
export function markAt(window: WindowMarks, name: string): number | null {
  return window.marks[name]?.[0] ?? null;
}

/**
 * 隣り合う打刻のあいだの区間を並べる。
 *
 * @remarks
 * **在る打刻同士だけ**を繋ぎます。途中の打刻が無い窓では、その前後が 1 つの区間になります ——
 * どの段でそれだけ掛かったのかは言えないので、区間の名前が `from → to` を持ちます。
 */
export function toPhases(window: WindowMarks): readonly Phase[] {
  const present = MARK_ORDER.flatMap((name) => {
    const at = markAt(window, name);

    return at === null ? [] : [{ name, at }];
  });

  // 末尾を先に落とさず全件を歩く。落としてから「次が無い」を見ると、その枝へは決して
  // 到達せず、塞げない分岐が残る。
  return present.flatMap((start, index) => {
    const end = present[index + 1];

    if (end === undefined) {
      return [];
    }

    return [
      {
        name: `${start.name} → ${end.name}`,
        from: start.name,
        to: end.name,
        seconds: end.at - start.at,
      },
    ];
  });
}

/**
 * 窓の所見を挙げる。
 *
 * @remarks
 * 打刻だけで決まるものに限ります。「なぜ時間が掛かったか」は打刻からは出ないので、ここは
 * 触れません（[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 2 の分担）。
 */
export function toAnomalies(window: WindowMarks): readonly Anomaly[] {
  const found: Anomaly[] = [];
  const stamped = MARK_ORDER.filter((name) => markAt(window, name) !== null);

  // 窓の開閉そのものは段の境界ではない。それしか無い窓は「飛ばした」のではなく、
  // 何も起きなかった窓である。両者を同じ所見にすると、後者が 6 段ぶんの雑音を出す。
  const crossed = stamped.filter((name) => name !== "openedAt" && name !== "closedAt");

  if (crossed.length === 0) {
    found.push({ kind: "打刻が開始だけ", detail: "窓は開いたが、どの段の境界も越えていない" });
  }

  if (markAt(window, "closedAt") === null) {
    found.push({ kind: "窓が開いたまま", detail: "closedAt がない。集計の対象は閉じた窓だけ" });
  }

  let previous: { name: string; at: number } | null = null;

  for (const name of MARK_ORDER) {
    const at = markAt(window, name);

    if (at === null) {
      continue;
    }

    if (previous !== null && at < previous.at) {
      found.push({
        kind: "順序が逆",
        detail: `${name} が ${previous.name} より早い（${previous.at - at} 秒）`,
      });
    }

    previous = { name, at };
  }

  // 途中を飛ばした窓。越えていない段があるのか、刻み忘れなのかはここでは決まらないので、
  // 飛んだ事実だけを出す。境界を 1 つも越えていない窓は上で報告済みなので、ここでは見ない。
  //
  // **範囲は「窓が開いてから、最後に越えた境界まで」である。**終端を closedAt に取ると、
  // 到達しなかった先の段まで「飛んだ」に数えてしまう —— PR を出す前に閉じた窓は、
  // merge を飛ばしたのではなく、そこまで進まなかっただけである。
  const firstStamped = MARK_ORDER.findIndex((name) => markAt(window, name) !== null);
  const lastCrossed = MARK_ORDER.findLastIndex(
    (name) => crossed.includes(name) && markAt(window, name) !== null,
  );
  const missing =
    crossed.length === 0
      ? []
      : MARK_ORDER.slice(firstStamped + 1, lastCrossed).filter(
          (name) => markAt(window, name) === null,
        );

  // 任意の段しか欠けていない窓は所見にしない。計画の承認は、計画を要さない小さな変更では
  // そもそも起きない —— それを「飛んだ」と呼ぶと、正常な窓のほとんどが所見を持つ。
  // 欠けが必須の段へ及んだときだけ、任意の段も含めて何が刻まれなかったかを並べる。
  const skipped = missing.some((name) => !OPTIONAL_MARKS.includes(name)) ? missing : [];

  if (skipped.length > 0) {
    found.push({ kind: "段が飛んでいる", detail: `刻まれていない: ${skipped.join(" / ")}` });
  }

  return found;
}

/** その名前が刻まれた回数。何を数えると所見になるかは `COUNTED_MARKS` が持つ。 */
export function countOf(window: WindowMarks, name: string): number {
  return window.marks[name]?.length ?? 0;
}

/**
 * 送出に値する窓か。
 *
 * @remarks
 * **開いて閉じただけの窓を外へ出しません。**段の境界を 1 つも越えていない窓は、何も起きな
 * かった窓であって所見ではありません。`/clear` はそれだけで窓を 1 つ作るので、これを通すと
 * **中身の無い issue が起動回数ぶん立ちます**。
 *
 * 閉じているかどうかはここでは見ません —— 開いたままの窓を送らないのは送出側の判断で、
 * 理由が違うためです（半分の窓は遅れた窓より悪い）。
 */
export function isSubstantive(window: WindowMarks): boolean {
  return MARK_ORDER.some(
    (name) => name !== "openedAt" && name !== "closedAt" && markAt(window, name) !== null,
  );
}

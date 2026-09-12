// 測った結果から「なぜその値になったか」を引く。数値そのものは budget.ts が判定する。

/** 画素が動いた要素 1 つ。 */
export type ShiftedElement = {
  /** その要素が寄与した CLS。 */
  readonly score: number;
  /** 掴むための selector。 */
  readonly selector: string;
  readonly finalTop: number;
  readonly height: number;
};

/** 起動時に実行した script 1 つ。 */
type BootupScript = {
  readonly url: string;
  /** 解析・実行の合計 (ms)。 */
  readonly total: number;
  /** そのうち実行 (ms)。 */
  readonly scripting: number;
};

/** 1 画面ぶんの見立て。 */
export type Diagnosis = {
  readonly screen: string;
  readonly viewportHeight: number;
  readonly shifted: readonly ShiftedElement[];
  readonly bootup: readonly BootupScript[];
  readonly largestPaintElement: string | undefined;
};

type Lhr = {
  audits?: Record<string, { details?: { items?: unknown[] } } | undefined>;
  configSettings?: { screenEmulation?: { height?: number } };
};

function itemsOf(lhr: Lhr, audit: string): unknown[] {
  return lhr.audits?.[audit]?.details?.items ?? [];
}

/**
 * 押し下げられた距離を、寄与した CLS から逆算する。
 *
 * @remarks
 * CLS は「動いた範囲が viewport に占める割合 × 動いた距離が viewport の高さに占める割合」なので、
 * 確定後の位置と高さが分かれば動く前の位置を解ける。**確定後に viewport の外にある要素**
 * （押し下げられて視界から出たもの）だけを解く —— これが待機表示と実物の高さのずれの形である。
 * それ以外は解かずに `undefined` を返す。
 */
export function estimateShift(
  element: ShiftedElement,
  viewportHeight: number,
): { readonly before: number; readonly distance: number } | undefined {
  if (element.finalTop < viewportHeight || viewportHeight <= 0) {
    return undefined;
  }

  let best: { before: number; distance: number } | undefined;
  let bestGap = Number.POSITIVE_INFINITY;

  for (let before = 0; before < viewportHeight; before += 1) {
    const visible = Math.min(viewportHeight, before + element.height) - before;
    const distance = element.finalTop - before;
    const gap = Math.abs((visible / viewportHeight) * (distance / viewportHeight) - element.score);

    if (gap < bestGap) {
      bestGap = gap;
      best = { before, distance };
    }
  }

  // 解けたと言えるのは、寄与した CLS を 1% の精度で再現できたときだけ。
  return bestGap <= element.score * 0.01 ? best : undefined;
}

/** LHR から見立てを引く。 */
export function readDiagnosis(screen: string, lhr: Lhr): Diagnosis {
  const shifted = itemsOf(lhr, "layout-shifts").flatMap((raw) => {
    const item = raw as { score?: number; node?: { selector?: string; boundingRect?: unknown } };
    const rect = item.node?.boundingRect as { top?: number; height?: number } | undefined;

    return item.score === undefined || rect?.top === undefined || rect.height === undefined
      ? []
      : [
          {
            score: item.score,
            selector: item.node?.selector ?? "(要素不明)",
            finalTop: rect.top,
            height: rect.height,
          },
        ];
  });

  const bootup = itemsOf(lhr, "bootup-time").flatMap((raw) => {
    const item = raw as { url?: string; total?: number; scripting?: number };

    return item.url === undefined || item.total === undefined
      ? []
      : [{ url: item.url, total: item.total, scripting: item.scripting ?? 0 }];
  });

  const paint = itemsOf(lhr, "largest-contentful-paint-element")[0] as
    | { items?: { node?: { selector?: string } }[] }
    | undefined;

  return {
    screen,
    viewportHeight: lhr.configSettings?.screenEmulation?.height ?? 0,
    shifted,
    bootup,
    largestPaintElement: paint?.items?.[0]?.node?.selector,
  };
}

/** 上位いくつまで script を挙げるか。 */
const BOOTUP_LIMIT = 3;

/** 見立てを人が読む形にする。 */
export function formatDiagnosis(diagnosis: Diagnosis): string {
  const lines = [`📄 ${diagnosis.screen}`];

  if (diagnosis.shifted.length === 0) {
    lines.push("  画素は動いていません。");
  } else {
    lines.push("  動いた要素:");

    for (const element of diagnosis.shifted) {
      lines.push(`    ${element.score.toFixed(4)}  ${element.selector}`);

      const moved = estimateShift(element, diagnosis.viewportHeight);

      if (moved !== undefined) {
        lines.push(
          `      確定後 top=${element.finalTop} ← 動く前 top≈${moved.before}` +
            `（約 ${moved.distance} px 押し下げ）`,
        );
      }
    }
  }

  if (diagnosis.bootup.length > 0) {
    lines.push("  起動時に実行した script:");

    for (const script of [...diagnosis.bootup]
      .sort((left, right) => right.total - left.total)
      .slice(0, BOOTUP_LIMIT)) {
      lines.push(
        `    ${Math.round(script.total)} ms（実行 ${Math.round(script.scripting)} ms）  ${script.url}`,
      );
    }
  }

  if (diagnosis.largestPaintElement !== undefined) {
    lines.push(`  最大の描画: ${diagnosis.largestPaintElement}`);
  }

  return lines.join("\n");
}

// 置き場と撮影対象のずれを見つけ、レポートへ運ぶ形にする。
//
// story 単位と画面単位の 1 対 1 検査が同じことをする。違うのは在るべき一覧の組み立てだけで、
// それは呼ぶ側が渡す。
import { BASELINE_MISSING, BASELINE_ORPHAN, missingBaselines, orphanBaselines } from "./orphans";

/** 置き場と撮影対象のずれ。 */
export type BaselineGap = {
  /** 撮影対象を失った基準画像。撮り直しでは直らないので、消す相手。 */
  readonly orphans: string[];
  /** 基準画像を持たない撮影対象。撮る相手。 */
  readonly missing: string[];
};

/**
 * ずれを見つけ、注記へ載せる。
 *
 * @remarks
 * **注記へ載せるのは、撮り直しが全数へ落ちずに済むようにするためです。** 理由は注記型
 * `BASELINE_ORPHAN` / `BASELINE_MISSING`（orphans.ts）が持ちます。
 *
 * 注記の配列をそのまま受け取るのは、`TestInfo` を丸ごと要らないためです。要ると、この関数を
 * 確かめるのに Playwright の実行が要ります。
 *
 * @param annotations - 載せ先（`testInfo.annotations`）
 * @param present - 置き場にある基準画像
 * @param expected - 在るべき基準画像
 */
export function noteBaselineGap(
  annotations: { type: string; description?: string }[],
  present: readonly string[],
  expected: readonly string[],
): BaselineGap {
  const orphans = orphanBaselines(present, expected);
  const missing = missingBaselines(present, expected);

  for (const baseline of orphans) {
    annotations.push({ type: BASELINE_ORPHAN, description: baseline });
  }

  for (const baseline of missing) {
    annotations.push({ type: BASELINE_MISSING, description: baseline });
  }

  return { orphans, missing };
}

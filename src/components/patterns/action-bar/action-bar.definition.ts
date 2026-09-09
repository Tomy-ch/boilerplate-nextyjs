/**
 * 操作の領域をどこに出すか。
 *
 * @see Storybook `Container/ActionBar`
 */
export const ACTION_BAR_POSITION: Readonly<{
  INLINE: "inline";
  STICKY: "sticky";
  FIXED: "fixed";
  FIXED_WITHOUT_ASIDE: "fixed-without-aside";
}> = {
  /** 本文の流れの中に置く。 */
  INLINE: "inline",
  /** scroll 領域の下端に貼り付ける。 */
  STICKY: "sticky",
  /** viewport の下端に固定する。 */
  FIXED: "fixed",
  /** 脇に領域を持てない帯では viewport の下端に固定し、持てる幅では流れの中へ戻す。 */
  FIXED_WITHOUT_ASIDE: "fixed-without-aside",
};

/** {@link ACTION_BAR_POSITION} のいずれか。 */
export type ActionBarPosition = (typeof ACTION_BAR_POSITION)[keyof typeof ACTION_BAR_POSITION];

/**
 * 位置ごとの見た目。
 *
 * @remarks
 * `sticky` / `fixed` は内容の上へ重なるため、背景は必ず不透明にする。`bg-muted` のような面の色では
 * なく `bg-background` を使い、上辺の border だけで本文と切り分ける。
 *
 * `fixed` の `z-40` は overlay（`z-50`）より下、本文の中の重なりより上に置くための値である。下端の
 * 余白は iOS のホームバーを避けるため safe area と比較して大きいほうを採る。
 *
 * `fixed-without-aside` が戻る幅は `lg` である。脇に常設する領域を出す下限がそこだと
 * `docs/rules.md`「レイアウトと帯」の「脇に常設する領域は `lg` 以上でだけ出す」と「常に届く操作は
 * `lg` 未満で画面下端に固定する」が定めており、脇に操作が並ぶ幅では下端に重ねる理由が無くなる。
 */
export const ACTION_BAR_POSITION_CLASS: Record<ActionBarPosition, string> = {
  [ACTION_BAR_POSITION.INLINE]: "rounded-md border border-border bg-muted px-3 py-2",
  [ACTION_BAR_POSITION.STICKY]:
    "sticky bottom-0 z-10 border-t border-border bg-background px-3 py-2",
  [ACTION_BAR_POSITION.FIXED]:
    "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-3 pt-2 pb-[max(--spacing(2),env(safe-area-inset-bottom))]",
  [ACTION_BAR_POSITION.FIXED_WITHOUT_ASIDE]:
    "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-3 pt-2 pb-[max(--spacing(2),env(safe-area-inset-bottom))] lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0",
};

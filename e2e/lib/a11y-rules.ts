// 画面単位の a11y 検査で無効にする axe のルール。無効化の宣言はここだけが持つ —— spec 側で
// `rules: { ... }` を書けるようにすると、画面を足した人がその場で黙らせられる
// （story 側の [vrt/lib/a11y-rules.ts](../../vrt/lib/a11y-rules.ts) と同じ立て方）。
//
// 適合目標と、タグ指定の副作用で有効化されるものの打ち消しは story 側から借りる。目標は
// 1 つの決定であり、検査地点ごとに別の水準を持つと、どちらが正なのかが読めなくなる。
//
// 中立の置き場は作らず、story 側の宣言を直に import する。借り手が 2 つのうちは、共有の器を
// 新設する代価に見合わない。**3 つ目の検査地点が現れたら**見直す。
import { DEFAULT_OFF_RULES, type DisabledRule } from "../../vrt/lib/a11y-rules";

export { CONFORMANCE_TAGS } from "../../vrt/lib/a11y-rules";

/**
 * story では原理的に成立せず、ここで初めて見られるルール。
 *
 * @remarks
 * story は部品を単独で描くため、内容を包む landmark も `main` も h1 も持てません。この 3 つは
 * **画面を組み上げてはじめて壊れる**種類で、部品をいくら足しても鳴りません。
 *
 * **この 3 つは axe では `best-practice` タグしか持たず、適合目標のタグ集合
 * （{@link CONFORMANCE_TAGS}）では走りません。** タグで範囲を宣言する限り、有効にしたつもりでも
 * 評価されないままになります。だからここは**規則名で名指しして別に走らせる**列であり、単なる
 * 記録ではありません。ここへタグ側で走るルールを入れると、同じ違反が 2 度並びます。
 *
 * 配信される document 水準（`html-has-lang` / `document-title`）はこの列に入りません。どちらも
 * `wcag2a` なので適合目標の側で走ります。story との違いはルールではなく**評価される document** で、
 * あちらは Storybook の iframe の器を見ており、`src/app/layout.tsx` を見ていません。
 */
export const SCREEN_ONLY_RULES = ["region", "page-has-heading-one", "landmark-one-main"] as const;

/** 画面を名指しして外すルール 1 件。 */
export type ScreenDisabledRule = DisabledRule & {
  /** 対象の画面の名前（`e2e/lib/screens.ts` の `name`）。 */
  readonly screens: readonly string[];
};

/**
 * 画面を名指しして無効にするルール。
 *
 * @remarks
 * 全画面で外すほどの理由は無いが、その画面では鳴らしても直しようがないものを置きます。
 * 使う側の実装ではなく**取り除けない上流の実装が原因で、かつ実際には到達できない**ことが
 * 条件で、根拠は宣言そのものが持ちます。
 *
 * **「いまは直せない」は理由になりません。** 画面の違反は画面を直して消します。
 */
export const SCREEN_DISABLED_RULES: readonly ScreenDisabledRule[] = [];

/** axe へ渡す形へ畳む。`screenName` を渡すと、その画面を名指しした宣言も併せて外す。 */
export function screenDisabledRuleIds(
  screenName?: string,
  rules: readonly DisabledRule[] = DEFAULT_OFF_RULES,
  screenRules: readonly ScreenDisabledRule[] = SCREEN_DISABLED_RULES,
): string[] {
  const named =
    screenName === undefined
      ? []
      : screenRules.filter((rule) => rule.screens.includes(screenName)).map((rule) => rule.id);

  return [...new Set([...rules.map((rule) => rule.id), ...named])];
}

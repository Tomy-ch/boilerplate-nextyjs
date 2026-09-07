// story の a11y 検査で無効にする axe のルール。無効化の宣言はここだけが持つ —— spec 側で
// `rules: { ... }` を書けるようにすると、story を足した人がその場で黙らせられる。
//
// 全 story から外してよいのは、story が部品を単独で描画していることの副作用として鳴るものだけ。
// 「いまは直せない」は理由にならない —— 直せない違反は [excluded-stories](excluded-stories.ts) で
// story ごと外すか、実装を直す。特定の story でだけ外す宣言は STORY_DISABLED_RULES が持つ。
//
// landmark と h1 の 3 ルールは、ここでは無効化しない。部品を単独で描く限り成立せず、組み上げた
// 画面で初めて壊れるため、画面単位の検査（[e2e/lib/a11y-rules.ts](../../e2e/lib/a11y-rules.ts)）が持つ。

/**
 * 検査するルールの範囲。適合目標そのものを axe のタグで表す。
 *
 * @remarks
 * 目標は **WCAG 2.x レベル AA** です（[README](../README.md)）。axe は
 * 既定で目標の外側（`best-practice` など）まで回すため、範囲を宣言しないと「目標として掲げて
 * いない水準」を全 story ぶん評価することになります。
 *
 * ここに AAA を入れません。入れた時点で、宣言した目標と機械が要求する水準が食い違います。
 * 目標を引き上げるなら、[README](../README.md) が挙げる決定を先に変えます。
 */
export const CONFORMANCE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

/**
 * 範囲の宣言によって**新たに有効化されてしまう**ルール。
 *
 * @remarks
 * axe には既定で無効なルールがあります（誤検出が多い・手動確認が要るなど、axe 側の判断）。
 * タグで範囲を宣言すると axe はその既定を無視し、**タグに一致するものを既定の可否に関わらず
 * 走らせます**。範囲を絞る宣言が、絞ると同時に別のルールを増やすことになります。
 *
 * ここはその増分を打ち消し、**タグ指定の前後で走るルールが増えない**ことを保つためだけの宣言です。
 * 増やす判断をするなら、この宣言から外すのが手順になります。
 *
 * 実体は {@link CONFORMANCE_TAGS} と axe の既定から決まるので、宣言の過不足は
 * [テスト](a11y-rules.test.ts)が axe 本体と突き合わせて検出します。
 */
export const DEFAULT_OFF_RULES: readonly DisabledRule[] = [
  {
    id: "aria-roledescription",
    reason: "axe が既定で無効にしている。タグ指定の副作用で有効化しないために打ち消す。",
    removeWhen: "このルールを走らせる判断をしたとき。",
  },
  {
    id: "audio-caption",
    reason: "同上。",
    removeWhen: "同上。",
  },
];

export type DisabledRule = {
  /** axe のルール id。 */
  readonly id: string;
  /** 単独描画の副作用であることの説明。 */
  readonly reason: string;
  /** この宣言を落とせる条件。 */
  readonly removeWhen: string;
};

export const DISABLED_RULES: readonly DisabledRule[] = [];

/** story を名指しして外すルール 1 件。 */
export type StoryDisabledRule = DisabledRule & {
  /** 対象の story id（`storybook-static/index.json` の `id`）。 */
  readonly stories: readonly string[];
};

/**
 * story を名指しして無効にするルール。
 *
 * @remarks
 * 全 story で外すほどの理由は無いが、その story では鳴らしても直しようがないものを置きます。
 * 使う側の実装ではなく**取り除けない上流の実装が原因で、かつ実際には到達できない**ことが条件で、
 * 根拠は宣言そのものが持ちます。story を名指しするため、他の story では同じルールが生きたままです。
 */
export const STORY_DISABLED_RULES: readonly StoryDisabledRule[] = [
  {
    id: "aria-hidden-focus",
    stories: [
      "action-buttongroup--split-button-open",
      "container-tableviewoptions--menu-open",
      "form-selectclient--open",
      "overlay-dropdownmenu--grouped",
      "overlay-dropdownmenu--icon-trigger",
      "overlay-dropdownmenu--nested",
      "overlay-dropdownmenu--open",
      "overlay-dropdownmenu--with-selection",
      "overlay-dropdownmenu--with-selection-kept-open",
      "page-admin-products-list--row-actions-open", // sample:line
      "page-admin-users--row-actions-open", // sample:line
    ],
    reason:
      "Radix が modal の overlay を開くとき背景へ `aria-hidden` だけを当て、trigger は tabbable のまま残る。焦点は FocusScope が閉じ込めるため実際には届かない。axe も同じ場合を violation ではなく incomplete にする逃げ道を持つが、その判定は dialog しか見ないため menu では効かない。",
    removeWhen:
      "Radix が `aria-hidden` パッケージの `suppressOthers` へ移り、背景が `inert` になったとき。",
  },
  {
    id: "aria-hidden-focus",
    stories: ["navigation-navigationmenu--open", "navigation-navigationmenu--without-viewport"],
    reason:
      "Radix の NavigationMenu が `aria-hidden` と `tabIndex={0}` を併せ持つ focus proxy を描く。props で外せない内部実装で、keyboard で viewport へ入るための踏み台である。",
    removeWhen: "Radix が focus proxy を `aria-hidden` に頼らない形へ変えたとき。",
  },
];

/** axe へ渡す形へ畳む。`storyId` を渡すと、その story を名指しした宣言も併せて外す。 */
export function disabledRuleIds(
  storyId?: string,
  rules: readonly DisabledRule[] = [...DISABLED_RULES, ...DEFAULT_OFF_RULES],
  storyRules: readonly StoryDisabledRule[] = STORY_DISABLED_RULES,
): string[] {
  const named =
    storyId === undefined
      ? []
      : storyRules.filter((rule) => rule.stories.includes(storyId)).map((rule) => rule.id);

  return [...new Set([...rules.map((rule) => rule.id), ...named])];
}

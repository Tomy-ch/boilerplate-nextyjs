/**
 * 続きの読み込みが今どうなっているか。
 *
 * @remarks
 * 取得中・失敗・終端は同時に立ちません。真偽値を並べて表すと、両方が立った姿や、終端なのに
 * 失敗している姿まで型として通ります。
 *
 * 読み直す操作を `failed` だけが持つのは、それが唯一の復帰口だからです。渡し忘れた失敗という
 * 状態を書けなくしています。
 *
 * @see Storybook `Navigation/LoadMore`
 */
export type LoadMoreState =
  /** 読み終えている。続きが無い。 */
  | { readonly status: "exhausted" }
  /** 続きがあり、末尾へ近づくのを待っている。 */
  | { readonly status: "idle" }
  /** 続きを取得している最中。 */
  | { readonly status: "loading" }
  /** 直前の取得に失敗した。 */
  | { readonly status: "failed"; readonly onRetry: () => void };

// 配色の意味トークンの名前を、生成した CSS から取り出す。
//
// 値は持たない。SSOT から生成物までは `tokens-drift` が見ているので、ここで値を持つと同じ表を
// 2 箇所に持つことになる。名前だけを取り、実ブラウザで読んだ結果の突き合わせに使う。

/** 意味トークンの別名の宣言。primitive(`--color-neutral-100: #ededed`)とはこの形で分かれる。 */
const SEMANTIC_ALIAS = /^[ \t]*--color-[a-z0-9-]+:[ \t]*var\((--semantic-color-[a-z0-9-]+)\);/gm;

/**
 * 色以外の意味トークンと、その値を読むために使う CSS プロパティ。
 *
 * @remarks
 * 系統は色だけでなく書体・太さ・影も替えます。色だけを見ると、`--font-*` の別名を手書き CSS から
 * 直接引いた箇所のように**その系統だけ届かない**壊れ方を素通しします。プロパティを添えるのは、
 * 値の読み取りが型ごとに違うためです（色は `color`、書体は `font-family`）。
 */
const SEMANTIC_ALIAS_BY_PROPERTY: ReadonlyArray<readonly [RegExp, string]> = [
  // `--font-weight-*` を書体として読まないよう、先頭で除く
  [
    /^[ \t]*--font-(?!weight-)[a-z0-9-]+:[ \t]*var\((--semantic-font-[a-z0-9-]+)\);/gm,
    "fontFamily",
  ],
  [
    /^[ \t]*--font-weight-[a-z0-9-]+:[ \t]*var\((--semantic-font-weight-[a-z0-9-]+)\);/gm,
    "fontWeight",
  ],
  [/^[ \t]*--shadow-[a-z0-9-]+:[ \t]*var\((--semantic-shadow-[a-z0-9-]+)\);/gm, "boxShadow"],
  [
    /^[ \t]*--text-shadow-[a-z0-9-]+:[ \t]*var\((--semantic-text-shadow-[a-z0-9-]+)\);/gm,
    "textShadow",
  ],
];

/**
 * 継承する色を変えた 2 つの面で読んだ、同じトークンの解決結果。
 *
 * @remarks
 * 2 面で読むのは、宣言の無い custom property を使った宣言が「計算時に無効」となり、その
 * property が**継承値へ落ちる**ためです。継承値も色として読めるので、1 面だけでは届いた色と
 * 継承した色を区別できません。届いていれば継承元が何であれ同じ色が返ります。
 */
export type TokenReadings = readonly [string, string];

/**
 * 生成した CSS から配色の意味トークンの名前を取り出す。
 *
 * @remarks
 * 取り出すのは**別名(`--color-*`)ではなく実体(`--semantic-color-*`)の名前**です。別名は
 * `@theme inline` が `:root` で 1 度だけ解決するため、系統(`data-surface`)を切り替えた部分木では
 * 再解決されません。別名を読むと、系統の再束縛が届いていても値が変わらず見えます。
 *
 * 1 つも見つからなければ例外を投げます。0 件へ縮退させると、検査する対象が無い状態が
 * 「すべて届いている」として緑で通ります。
 */
export function semanticColorTokens(css: string): string[] {
  const names = [...css.matchAll(SEMANTIC_ALIAS)].map(([, name]) => name as string).sort();
  if (names.length === 0) throw new Error("配色の意味トークンが 1 つも見つかりません");

  return names;
}

/** 変数名と、その値を読むための CSS プロパティの対。 */
export type TokenProbe = { readonly name: string; readonly property: string };

/**
 * 生成した CSS から、色以外の意味トークンの名前を、読み取りに使うプロパティとともに取り出す。
 *
 * @remarks
 * 1 つも見つからなければ例外を投げます（{@link semanticColorTokens} と同じ規律）。
 */
export function semanticNonColorTokens(css: string): TokenProbe[] {
  const probes = SEMANTIC_ALIAS_BY_PROPERTY.flatMap(([pattern, property]) =>
    [...css.matchAll(pattern)].map(([, name]) => ({ name: name as string, property })),
  ).sort((a, b) => a.name.localeCompare(b.name));

  if (probes.length === 0) throw new Error("色以外の意味トークンが 1 つも見つかりません");

  return probes;
}

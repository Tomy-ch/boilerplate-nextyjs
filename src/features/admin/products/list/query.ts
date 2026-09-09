import { ADMIN_PRODUCT_LIST_PATH } from "../../paths";

/**
 * 絞り込みを載せる URL のキー。契約のクエリ名と揃える。
 *
 * @remarks
 * 分類と状態は契約と同じく並びで載せます。**同じキーを繰り返す形**で、区切り文字で連結しません。
 * 連結しない理由も複数を選ばせる理由も `docs/spec/route/admin/products/page.function.md`「検索条件は URL が持つ」。
 */
export const FILTER_KEY: Readonly<{
  KEYWORD: "keyword";
  CATEGORY: "categoryCodes";
  STATUS: "statusCodes";
}> = {
  KEYWORD: "keyword",
  CATEGORY: "categoryCodes",
  STATUS: "statusCodes",
};

/** いま見ているページの起点を載せる URL のキー。契約のクエリ名と揃える。 */
export const CURSOR_KEY = "after";

/**
 * ここまでに通ってきたページの起点を載せる URL のキー。
 *
 * @remarks
 * cursor は「次の位置」しか指さないため、戻る先はどこにも書かれていません。覚える場所を URL に
 * する理由は `docs/spec/route/admin/products/page.function.md`「戻る先は URL が覚える」。
 */
export const TRAIL_KEY = "trail";

/**
 * キーを画面上の呼び名へ直す表。
 *
 * @remarks
 * キーを持っているのはこの層なので、呼び名も同じ場所に置きます。表示する側が写しを持つと、
 * 契約にキーが増えたときに生の名前が出る画面と出ない画面に割れます。
 */
export const FILTER_KEY_LABEL: Readonly<Record<string, string>> = {
  [FILTER_KEY.KEYWORD]: "キーワード",
  [FILTER_KEY.CATEGORY]: "分類",
  [FILTER_KEY.STATUS]: "状態",
  [CURSOR_KEY]: "読み込み位置",
};

/**
 * 一覧に効いている絞り込み。
 *
 * @remarks
 * 「指定なし」は**空の並び**です。選択肢の側に指定なしを置くと、複数選べる条件では「指定なし」と
 * 具体的な値を同時に選べてしまいます。
 */
export type AdminProductListConditions = {
  /** 商品名に含まれる語。 */
  readonly keyword: string;
  /** 分類のコード。空なら分類で絞り込まない。 */
  readonly categoryCodes: readonly string[];
  /** 状態のコード。空なら状態で絞り込まない。 */
  readonly statusCodes: readonly string[];
};

/** 一覧の URL が表す、いま見ている場所。 */
export type AdminProductListLocation = AdminProductListConditions & {
  /** いま見ているページの起点。先頭ページでは null。 */
  readonly cursor: string | null;
  /** ここまでに通ってきたページの起点。先頭ページから順に並ぶ。 */
  readonly trail: readonly string[];
};

function toHref(
  conditions: AdminProductListConditions,
  cursor: string | null,
  trail: readonly string[],
): string {
  const params = new URLSearchParams();

  if (conditions.keyword !== "") {
    params.set(FILTER_KEY.KEYWORD, conditions.keyword);
  }

  for (const [key, values] of [
    [FILTER_KEY.CATEGORY, conditions.categoryCodes],
    [FILTER_KEY.STATUS, conditions.statusCodes],
  ] as const) {
    for (const value of values) {
      params.append(key, value);
    }
  }

  if (cursor !== null) {
    params.set(CURSOR_KEY, cursor);

    for (const passed of trail) {
      params.append(TRAIL_KEY, passed);
    }
  }

  return params.size === 0
    ? ADMIN_PRODUCT_LIST_PATH
    : `${ADMIN_PRODUCT_LIST_PATH}?${params.toString()}`;
}

/**
 * 絞り込みを変えた先の URL を組む。
 *
 * @remarks
 * 読み進めた位置は載せません。条件が変わった後の「続き」は前の条件の続きを指しており、そのまま
 * 引き継ぐと、絞り直したのに前の条件の途中から始まります。
 */
export function toConditionHref(conditions: AdminProductListConditions): string {
  return toHref(conditions, null, []);
}

/** 次のページの URL を組む。 */
export function toNextPageHref(location: AdminProductListLocation, nextCursor: string): string {
  const trail = location.cursor === null ? [] : [...location.trail, location.cursor];

  return toHref(location, nextCursor, trail);
}

/**
 * 前のページの URL を組む。
 *
 * @remarks
 * 先頭ページには戻る先がないため、行き先を返しません。省略された向きは押せない control として
 * 描かれます（`components/app-starter/cursor-pagination`）。
 *
 * @returns 先頭ページなら undefined
 */
export function toPreviousPageHref(location: AdminProductListLocation): string | undefined {
  if (location.cursor === null) {
    return undefined;
  }

  const trail = [...location.trail];
  const previous = trail.pop() ?? null;

  return toHref(location, previous, trail);
}

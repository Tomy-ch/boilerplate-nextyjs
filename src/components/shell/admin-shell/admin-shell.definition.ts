/** 脇の一覧に並べる導線 1 件。 */
export type AdminShellNavItem = {
  /** 遷移先のパス。 */
  href: string;
  /** 導線の表示名。 */
  label: string;
};

/**
 * 見出しを押せないものに留めた、導線のまとまり 1 つ。
 *
 * @remarks
 * 押せる見出しを許すと、見出しを押したときの行き先と、その下の先頭項目の行き先が同じか違うかを
 * 利用者が毎回確かめることになります。
 */
export type AdminShellNavGroup = {
  /** まとまりの見出し。 */
  label: string;
  /** そのまとまりに属する導線。 */
  items: readonly AdminShellNavItem[];
};

/** skip link の飛び先。`main` の id と対で使う。 */
export const ADMIN_SHELL_MAIN_ID = "admin-main-content";

/**
 * header が占める高さ（px）。
 *
 * @remarks
 * 脇の一覧は上端から始まり、その先頭に自分の見出し行を持つ。行の高さをこの値に揃えることで、
 * 見出し行の下端と header の下端が 1 本の線として続く。ずれると器の縦の区切りが 2 本に割れる。
 *
 * **内訳は行の 56px と下の境界線 1px。** 占める高さを表す値なので境界線を含む。
 */
export const ADMIN_SHELL_HEADER_HEIGHT = 57;

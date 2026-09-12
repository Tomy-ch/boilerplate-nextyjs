import { ADMIN_INQUIRY_LIST_PATH } from "../paths";

/** いま見ているページの起点を載せる URL のキー。契約のクエリ名と揃える。 */
export const CURSOR_KEY = "after";

/**
 * ここまでに通ってきたページの起点を載せる URL のキー。
 *
 * @remarks
 * cursor は「次の位置」しか指さないため、戻る先はどこにも書かれていません。覚える先を URL に
 * するのは、戻る操作と共有した URL が同じ場所を指すためです。
 */
export const TRAIL_KEY = "trail";

/** 一覧の URL が表す、いま見ている場所。 */
export type AdminInquiryListLocation = {
  /** いま見ているページの起点。先頭ページでは null。 */
  readonly cursor: string | null;
  /** ここまでに通ってきたページの起点。先頭ページから順に並ぶ。 */
  readonly trail: readonly string[];
};

function toHref(cursor: string | null, trail: readonly string[]): string {
  if (cursor === null) {
    return ADMIN_INQUIRY_LIST_PATH;
  }

  const params = new URLSearchParams();

  params.set(CURSOR_KEY, cursor);

  for (const passed of trail) {
    params.append(TRAIL_KEY, passed);
  }

  return `${ADMIN_INQUIRY_LIST_PATH}?${params.toString()}`;
}

/** 次のページの URL を組む。通ってきた起点に、いまの起点を積む。 */
export function toNextPageHref(location: AdminInquiryListLocation, nextCursor: string): string {
  const trail = location.cursor === null ? [] : [...location.trail, location.cursor];

  return toHref(nextCursor, trail);
}

/**
 * 前のページの URL を組む。先頭ページでは `undefined`。
 *
 * @remarks
 * 積んである起点の末尾が 1 つ前のページで、それを降ろした残りがそのページの通り道になります。
 */
export function toPreviousPageHref(location: AdminInquiryListLocation): string | undefined {
  if (location.cursor === null) {
    return undefined;
  }

  const previous = location.trail.at(-1);

  return previous === undefined
    ? ADMIN_INQUIRY_LIST_PATH
    : toHref(previous, location.trail.slice(0, -1));
}

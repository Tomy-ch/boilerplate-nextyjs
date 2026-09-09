/**
 * 一致 1 件から、番号で指した捕捉群を文字列として取り出す。
 *
 * @remarks
 * 一致の配列を添字で読むと、パターンが必ず参加させる群でも型は `string | undefined` になり、
 * 読む側が毎回 `undefined` を捌く形になります。ここを通すと、参加しなかった群（`(...)?` と、
 * 選択肢の外れた側）は空文字として読めます。
 *
 * 空文字にするのは、読む側に「無い」と「空だった」の区別が要らないためです。任意の群は
 * 中身を必須にして書かれているので、空文字は参加しなかったことと同じです。
 */
export function groupAt(match: RegExpMatchArray, at: number): string {
  return match[at] ?? "";
}

/** {@link groupAt} を複数の番号へ同時に掛け、指した順の並びとして返す。 */
export function groupsAt(match: RegExpMatchArray, first: number): readonly [string];
export function groupsAt(
  match: RegExpMatchArray,
  first: number,
  second: number,
): readonly [string, string];
export function groupsAt(
  match: RegExpMatchArray,
  first: number,
  second: number,
  third: number,
): readonly [string, string, string];
export function groupsAt(match: RegExpMatchArray, ...at: readonly number[]): readonly string[] {
  return at.map((position) => groupAt(match, position));
}

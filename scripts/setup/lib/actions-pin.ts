// `.github/actions-pin.toml` から、参照が消えた action の pin を落とす判定。
//
// 剥がしと、資格情報を要するスキャナの撤去の双方が使う。`make actions-pin-check` は
// 「どの workflow も参照しないエントリ」で落ちるため、workflow を消した側が pin も始末する。
//
// **ロックファイル側にマーカーを置いて済ませられない。**書き出しはヘッダと本文を毎回組み直す
// ため、`make actions-pin-resolve` を 1 度でも回した時点でマーカーが消える。

/**
 * 孤児になる pin の行を落とす。
 *
 * @param text - `.github/actions-pin.toml` の中身。
 * @param actions - 落とす action の名前。
 * @returns 書き戻す中身。落とす行が無ければ元のまま。
 */
export function dropOrphanedPins(text: string, actions: readonly string[]): string {
  const lines = text.split("\n");
  const kept = lines.filter((line) => !actions.some((action) => line.startsWith(`"${action}@`)));

  return kept.length === lines.length ? text : kept.join("\n");
}

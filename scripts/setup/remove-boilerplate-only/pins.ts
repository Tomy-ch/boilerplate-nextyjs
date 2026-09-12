/**
 * 剥がしで参照が消える action pin の除去。
 *
 * @remarks
 * `.github/actions-pin.toml` は「どの workflow も参照しないエントリ」で
 * [`make actions-pin-check`](../../../.makefiles/tools/actions-pin.mk) が落ちます。workflow を
 * まるごと消す剥がしは、その workflow だけが使っていた pin を必ず孤児にします。
 *
 * **ロックファイル側にマーカーを置いて済ませられません。** 書き出しはヘッダと本文を毎回組み直す
 * ため、`make actions-pin-resolve` を 1 度でも回した時点でマーカーが消え、**剥がしが黙って
 * 何もしなくなります**。宣言はロックファイルの外に持ちます。
 */

/**
 * 剥がしと同時に孤児になる action。
 *
 * @remarks
 * 版ではなく action の名前で宣言します。pin を上げるたびに書き換える宣言は、上げた人が
 * 気づかない場所で腐ります。
 */
export const ORPHANED_ACTIONS: readonly string[] = [
  "actions/dependency-review-action",
  "SonarSource/sonarqube-scan-action",
];

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

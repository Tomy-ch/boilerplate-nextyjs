/**
 * 明細を描く順を決める。
 *
 * @remarks
 * **覚えている並びが基準です。** これは削除の時点で画面が見せていた順で、取り除いた明細も消える前に
 * 居た場所に残っています（画面の見え方はサーバが持たない）。
 *
 * 覚えている並びに載っていない明細は、その後にカートへ入ったものです。末尾へ回します。載っているが
 * 今は居ない明細は、戻せるあいだだけ場所を保ちます。戻せなくなったもの（戻した後）は落ちます。
 *
 * 描画から切り出してあるのは、順の決め方だけが独立して変わるためです。器の見た目が変わっても順は
 * 変わらず、順の規則が変わっても器は変わりません。
 *
 * @param remembered - 覚えている並び
 * @param present - いまカートに入っている明細
 * @param recoverable - いま戻せる明細
 */
export function toCartLineOrder(
  remembered: readonly string[],
  present: readonly string[],
  recoverable: ReadonlySet<string>,
): readonly string[] {
  const kept = remembered.filter((id) => present.includes(id) || recoverable.has(id));

  return [...kept, ...present.filter((id) => !kept.includes(id))];
}

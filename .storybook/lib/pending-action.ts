/**
 * 決して終わらない送信先。
 *
 * @remarks
 * **送信中の姿をカタログに置くために要ります。** 送信中は `useFormStatus` が送信の完了で畳む
 * ため、すぐ返る送信先では撮る前に終わっています。ここで返す Promise は解決しないので、押した
 * 直後の姿がそのまま留まります。
 *
 * カタログに server は無く、押した先で本当に何かが起きることもありません
 * （[0054](../../docs/adr/0054-ui-catalog-storybook.md)）。留まるのは表示だけです。
 */
export function neverSettlingAction(): Promise<void> {
  return new Promise<void>(() => {});
}

/**
 * タグマネージャの容器 ID。空なら読み込まない。
 *
 * @remarks
 * 静的なドット参照でのみ読み、ここでは検証しません（client config の規約は
 * [config](../README.md) が持ちます）。置換されるのは検証を通った値そのものです。
 *
 * **ブラウザへ出て困る値ではありません。** 容器 ID はタグを読み込む URL に現れるので、
 * この機構を使うどのサイトでも公開されています。秘密は容器の中身の編集権限の側にあります。
 */
export const GTM_CONTAINER_ID: string = process.env["NEXT_PUBLIC_ANALYTICS_GTM_CONTAINER_ID"] ?? "";

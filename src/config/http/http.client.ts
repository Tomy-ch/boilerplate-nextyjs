/**
 * 1 つの要求 URL に許すバイト数の上限。
 *
 * @remarks
 * 静的なドット参照でのみ読み、ここでは検証しません（client config の規約は
 * [config](../README.md) が持ちます）。置換されるのは検証を通った値そのものです。
 *
 * 上限の意味は server 側と同じです。同じ変数を両側が読むので、閾値の宣言は env の 1 行だけです。
 */
export const MAX_URL_BYTES: number = Number(process.env["NEXT_PUBLIC_HTTP_MAX_URL_BYTES"]);

/**
 * 中継する 1 件のアップロードに許すバイト数の上限。
 *
 * @remarks
 * 送る前に弾くために読みます。ここで通した大きさを受け口が再び確かめます —— ブラウザ側の判定は
 * 送信者が差し替えられるため、これだけを根拠にできません。
 */
export const MAX_UPLOAD_BYTES: number = Number(process.env["NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES"]);

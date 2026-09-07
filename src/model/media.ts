/**
 * 画像を持たない対象に代わりに置く、アプリ同梱の画像。
 *
 * @remarks
 * 配信基盤ではなく `public/` に置いています。画像が無いことを伝える表示は、配信基盤に到達できない
 * ときでも出せる必要があるためです。
 */
export const NO_IMAGE_URL = "/no-image.svg";

/**
 * バックエンドが返すオブジェクトキーから配信 URL を組み立てる。
 *
 * @remarks
 * API が返すのはキー（`items/{uuid}.png`）だけで、URL は返しません。
 *
 * **組み立てた URL は必ず配信元の下に収まります。** キーは検証されないまま届く値であり、前置する
 * だけでは配信元の外を指す値を止められません。
 *
 * @param origin - 配信元の origin。呼び出し側が設定から供給する
 * @param imagePath - バックエンドが返したオブジェクトキー。未設定なら null
 * @returns 配信元の下に収まる URL。キーが無い・配信元そのものを指す・配信元の外を指す・URL として
 *          解釈できない場合は null
 */
export function mediaUrl(origin: string, imagePath: string | null): string | null {
  // 先頭の `/` を落とす。付いたままだと origin 直下の絶対パスとして扱われ、配信元がサブパスを
  // 持つ構成で経路が変わる。落とした結果が空になるキー（`/` だけ）は、指す先が配信元そのもので
  // あって画像ではないため、キーが無いのと同じ扱いにする。
  const key = imagePath === null ? "" : imagePath.replace(/^\/+/, "");

  if (key === "") {
    return null;
  }

  // 配信元も URL として持つ。文字列のまま前方一致を見ると、host の大小や既定ポートの有無で
  // 正規化が片側にだけ効き、実在するキーまで外と判定される。
  //
  // 問い合わせと素片は落とす。キーが解決されるのは経路に対してであり、残したまま前方一致を
  // 見ると、設定にそれが混ざっているだけで全部のキーが外と判定される。
  const configured = new URL(`${origin.replace(/\/+$/, "")}/`);
  const base = new URL(`${configured.origin}${configured.pathname}`);

  let resolved: URL;

  try {
    resolved = new URL(key, base);
  } catch {
    return null;
  }

  return resolved.href.startsWith(base.href) ? resolved.href : null;
}

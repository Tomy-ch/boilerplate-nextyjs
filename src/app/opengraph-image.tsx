import { ImageResponse } from "next/og";

import { SITE_NAME } from "./site";

/**
 * 共有先が読む代替文。
 *
 * @remarks
 * `export … from` では書けません。Next.js は metadata ファイルの export を segment の設定として
 * 読み、再 export を不正として build を止めます。
 */
export const alt = SITE_NAME;

/** OG 画像の推奨サイズ（1.91:1）。 */
export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

/**
 * 共有されたときに出る画像。
 *
 * @remarks
 * root に置くので、自分の画像を持たない全 route がこれを名乗ります。画面ごとの画像は、その
 * segment に `opengraph-image.tsx` を置いて上書きします。
 *
 * **描くのはサイトの名だけです。** 説明文は和文で、既定の書体では描けません（`SITE_NAME` が
 * ラテン限定である理由と同じ。`site.ts`）。書体を持ち込むかは、絵を決めるときに一緒に判断します。
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111827",
        color: "#f9fafb",
        fontSize: 96,
        fontWeight: 700,
        letterSpacing: "-0.02em",
      }}
    >
      {SITE_NAME}
    </div>,
    size,
  );
}

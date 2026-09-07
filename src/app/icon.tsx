import { ImageResponse } from "next/og";

import { SITE_MONOGRAM } from "./site";

/** ブラウザのタブに載る大きさ。 */
export const size = { width: 32, height: 32 };

export const contentType = "image/png";

/**
 * タブに載るアイコン。
 *
 * @remarks
 * 生成するのは印を 1 文字描くだけの絵で、テンプレートから作った側が自分の印へ差し替える枠です。
 * 同じ印を `apple-icon.tsx` が大きな枠で描きます。隣の `favicon.ico` は `<link>` を読まずに `/favicon.ico`
 * を直接取りに来る経路のために残してあり、差し替えるときは 3 つを揃えます。
 */
export default function Icon() {
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
        fontSize: 22,
        fontWeight: 700,
        borderRadius: 6,
      }}
    >
      {SITE_MONOGRAM}
    </div>,
    size,
  );
}

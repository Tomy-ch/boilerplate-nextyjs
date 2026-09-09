import { ImageResponse } from "next/og";

import { SITE_MONOGRAM } from "./site";

/** ホーム画面に置かれる大きさ。 */
export const size = { width: 180, height: 180 };

export const contentType = "image/png";

/**
 * ホーム画面に置かれるアイコン。
 *
 * @remarks
 * `icon.tsx` と同じ印を大きな枠で描きます。角は丸めません —— 置く側が自分の形に切り抜くため、
 * こちらで丸めると二重に削れます。
 */
export default function AppleIcon() {
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
        fontSize: 120,
        fontWeight: 700,
      }}
    >
      {SITE_MONOGRAM}
    </div>,
    size,
  );
}

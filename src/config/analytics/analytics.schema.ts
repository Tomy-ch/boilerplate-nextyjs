import { z } from "zod";

/** analytics purpose 専用の ENV validator を定義する。 */

/**
 * 容器 ID の綴り。
 *
 * @remarks
 * 空を既定にします。**空は「未設定」ではなく「読み込まない」という指定**です —— テンプレートから
 * Google への依存を外す口がこれで、外した状態でも画面が成立することが同梱の条件に
 * なっています。
 *
 * 綴りを検証するのは、誤った ID がそのまま配信ヘッダの許可と一緒に出ていくのを防ぐためです。
 * 値が違えばタグは読めませんが、`script-src` は開いたままになります。
 */
const gtmContainerId = z
  .string()
  .default("")
  .refine((value) => value === "" || /^GTM-[A-Z0-9]+$/.test(value), {
    error: "容器 ID は `GTM-` で始まる英数字です。読み込ませない配備では空にしてください",
  });

/** タグマネージャの容器 ID を検証する。空は読み込まないことを表す。 */
export function gtmContainerIdValidator() {
  return gtmContainerId;
}

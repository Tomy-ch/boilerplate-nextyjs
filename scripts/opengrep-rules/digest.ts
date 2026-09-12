// 取り出したルール集合の digest。
//
// 照合したいのは「走らせるルールが固定したものと同じか」であって、包み方ではない。GitHub が
// 自動生成する tarball はバイト単位で不変ではないため、アーカイブを照合対象にすると中身が
// 同じでも落ちる日が来る。中身そのものから取れば、包み方が変わっても答えは変わらない。
import { createHash } from "node:crypto";

export type RuleFile = {
  /** {@link RULES_DIR} からの相対パス。 */
  path: string;
  content: string;
};

/**
 * ルール集合の digest を求める。
 *
 * @remarks
 * パスと中身の**両方**を混ぜます。中身だけだと、同じルールが別の場所へ移動しても digest が
 * 動かず、rule id（パス由来）が変わったことに気づけません。
 *
 * 区切りに `\0` を使うのは、パスに現れない 1 バイトだからです。改行やスラッシュで区切ると、
 * 境界を跨いだ別の組み合わせが同じ入力列を作りえます。
 *
 * @param files - 取り出したルール。順序は問わない（ここで固定する）
 * @returns 小文字 16 進の SHA-256
 */
export function ruleSetDigest(files: readonly RuleFile[]): string {
  // 組み立ててから並べる。比較関数を書くと「パスが等しい」枝が生まれるが、置き場から歩いて
  // 集める以上その入力は作れず、検査できない分岐だけが残る。既定の並びは UTF-16 の符号単位順で
  // 実行環境に依らない。
  const lines = files
    .map((file) => `${file.path}\0${createHash("sha256").update(file.content).digest("hex")}`)
    .sort();

  return createHash("sha256")
    .update(`${lines.join("\0")}\0`)
    .digest("hex");
}

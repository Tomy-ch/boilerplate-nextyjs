import * as z from "zod/mini";

/**
 * 検証を通った復帰先を確定させるスキーマ。
 *
 * @remarks
 * {@link toSafeReturnUrl} を通った値だけがこの型になります。
 */
const safeReturnUrlSchema = z.string().brand<"safeReturnUrl">();

/** {@link toSafeReturnUrl} を通った復帰先。同一 origin の相対パスであることが保証される。 */
export type SafeReturnUrl = z.infer<typeof safeReturnUrlSchema>;

/** 復帰先が無いときに送る先。 */
const FALLBACK_RETURN_URL = "/";

/**
 * 解決先を確かめるための、到達し得ない origin。
 *
 * @remarks
 * `.invalid` は名前解決されないことが保証された予約 TLD（RFC 6761）です。判定に使うだけで
 * 接続はしませんが、実在の名前を借りると、その名前が将来別の意味を持ったときに判定が変わります。
 */
const PROBE_ORIGIN = "http://internal.invalid"; // DevSkim: ignore DS137138

/**
 * 未認証で弾いた利用者を、認証後に戻す先を検証する。
 *
 * @remarks
 * 受け取った値をそのままリダイレクト先にすると、攻撃者の用意した URL へ自サイトの導線で送れて
 * しまいます（open redirect）。同一 origin の相対パスだけを通し、それ以外は既定の行き先へ倒します。
 *
 * **判定は文字列の見た目ではなく、URL パーサに解かせた結果で行います。** 文字列を先頭から検査する
 * 書き方は、パーサ側の正規化を再現できません。たとえば `/\t/evil.com` はタブが解析時に除去されて
 * `//evil.com`（protocol-relative URL）になり、「2 文字目が `/` か」という検査を素通りします。
 * 実際にリダイレクトへ渡るのは解決後の形なので、検査もその形に対して行う必要があります。
 *
 * 先頭が `/` であることも併せて要求します。origin の一致だけを見ると `reports/1` のような
 * 相対パスも通り、呼び出し側がどこを基準に解決するかで行き先が変わります。
 *
 * @param candidate - クエリや form から受け取った復帰先候補。文字列でない値もここへ届く
 * @returns 安全と判定した、解決済みの相対パス。判定に落ちたときは `/`
 */
export function toSafeReturnUrl(candidate: unknown): SafeReturnUrl {
  return safeReturnUrlSchema.parse(resolveReturnUrl(candidate));
}

/** 候補を、通ってよい形へ倒す。 */
function resolveReturnUrl(candidate: unknown): string {
  if (typeof candidate !== "string" || !candidate.startsWith("/")) {
    return FALLBACK_RETURN_URL;
  }

  // 先頭が `/` である相対参照は、基準 URL が妥当なら解析に失敗しない。ここを try で囲むと、
  // 到達できない分岐が残る。
  const resolved = new URL(candidate, PROBE_ORIGIN);

  if (resolved.origin !== PROBE_ORIGIN) {
    return FALLBACK_RETURN_URL;
  }

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

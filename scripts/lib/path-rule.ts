/**
 * 「このパスが動いたら、この理由でこう扱う」という規則と、その当て方。
 *
 * @remarks
 * 差分から何かを決める判定が複数あり（先送りにした検査を勧める側と、待たずに回すと決める側）、
 * どちらも**当て方は同じで、当てる一覧と理由だけが違います**。当て方をそれぞれが持つと、否定
 * パターンや大文字小文字の扱いを変える 1 つの依頼が 2 箇所への編集になり、型検査は食い違いを
 * 見つけません。
 *
 * 記法は [`path-pattern`](path-pattern.ts) の `**` と `*` だけです。
 */

import { toPathPattern } from "./path-pattern";

export type PathRule = {
  /** `**` と `*` だけの glob。 */
  readonly globs: readonly string[];
  /** その規則に当たったときに人へ伝える理由。 */
  readonly reason: string;
};

/**
 * その規則に当たるパスが差分にあるか。
 *
 * @param rule - 当てる規則。
 * @param paths - 変更されたパス。
 */
export function matchesPathRule(rule: PathRule, paths: readonly string[]): boolean {
  return rule.globs.some((glob) => {
    const pattern = toPathPattern(glob);

    return paths.some((path) => pattern.test(path));
  });
}

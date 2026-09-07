// 点検の結果を、読む形へ組む。落ちるかどうかは決めない —— それは入口が決める。

import { composeIssueBody } from "../lib/issue-body.js";
import type { ExpiredSuppression, MalformedSuppression, Suppression } from "./rules.js";

/**
 * 全件を 1 行ずつ並べる。
 *
 * @remarks
 * **期限を過ぎたものだけでなく、全件を出します。** 落ちた件だけを出すと、機械が判定できない条件が
 * 誰にも読まれないまま残るためです。
 *
 * @param suppressions - 読み取った宣言の全件
 */
export function renderDigest(suppressions: readonly Suppression[]): string {
  return suppressions
    .map((entry) => `${entry.source}\t${entry.subject}\t${entry.condition}`)
    .join("\n");
}

/**
 * 期限を過ぎた宣言の並び。
 *
 * @param expired - 撤回条件を満たした宣言
 */
export function renderExpired(expired: readonly ExpiredSuppression[]): string {
  return expired
    .map((entry) => `${entry.source} の ${entry.subject}（期限 ${entry.dueDate}）`)
    .join("\n");
}

/**
 * 様式を満たしていない宣言の並び。欠けているものを宣言ごとに添える。
 *
 * @param malformed - 様式を満たしていない宣言
 */
export function renderMalformed(malformed: readonly MalformedSuppression[]): string {
  return malformed
    .map((entry) => `${entry.source} の ${entry.subject}: ${entry.defects.join(" / ")}`)
    .join("\n");
}

/**
 * issue へ載せる本文。
 *
 * @remarks
 * **本文は `composeIssueBody` に組ませ、生の markdown 連結はしません。** 撤回条件の散文を書くのは
 * 抑止を足す PR の提出者だからです（無害化を観点に含める理由は [README](../README.md)）。
 * `tool-output` は字下げで記法を殺します。
 *
 * @param input.expired - 撤回条件を満たした宣言
 * @param input.malformed - 様式を満たしていない宣言
 * @param input.suppressions - 読み取った宣言の全件
 * @param input.commentBorneSources - 宣言単位では読めない面
 * @param input.runUrl - 実行の URL
 */
export function renderIssueBody(input: {
  readonly expired: readonly ExpiredSuppression[];
  readonly malformed: readonly MalformedSuppression[];
  readonly suppressions: readonly Suppression[];
  readonly commentBorneSources: readonly string[];
  readonly runUrl?: string;
}): string {
  const headings: string[] = [];

  if (input.expired.length > 0) {
    headings.push(`${input.expired.length} 件が撤回条件を満たしています。`);
  }

  if (input.malformed.length > 0) {
    headings.push(`${input.malformed.length} 件が様式を満たしていません。`);
  }

  return composeIssueBody({
    heading: headings.length === 0 ? "撤回条件を満たした宣言はありません。" : headings.join(" "),
    evidence: {
      kind: "tool-output",
      text: [
        renderExpired(input.expired),
        renderMalformed(input.malformed),
        "",
        renderDigest(input.suppressions),
      ]
        .join("\n")
        .trim(),
    },
    ...(input.runUrl === undefined ? {} : { runUrl: input.runUrl }),
    note: [
      "条件を満たした宣言は撤去してください。まだなら、条件そのものを書き直してください。様式を満たしていない宣言には、理由と撤回条件を書き足してください。",
      "",
      `次の面は撤回条件をコメントに持つため、**宣言単位では読めません**（日付を含む行だけが上に出ます）: ${input.commentBorneSources.join(" / ")}`,
    ].join("\n"),
  });
}

/**
 * 検査が落ちたときに立てる issue の本文。
 *
 * @remarks
 * 落ちた検査は、PR の外で落ちれば issue になります（`.github/workflows/README.md`）。本文の形は
 * どの検査でも同じで、**証拠 → 実行の URL → 次にやることの案内**の順に並べます。
 *
 * **描き方を呼ぶ側に選ばせません。** 証拠がこのリポジトリの書いたものか、道具が吐いたものかで
 * 描き方が変わり、判断を各ワークフローが持つと、道具の出力を markdown として描かせる面が
 * 1 つ混ざったことに誰も気付けません。ここが受け取るのは**出どころ**で、描き方はここが
 * 決めます。
 */

/** 本文へ載せる証拠。 */
export type IssueEvidence =
  /**
   * 道具が吐いたもの。表明の文言・違反の一覧・ログの末尾など。
   *
   * @remarks
   * 4 文字の字下げで描きます。markdown は字下げをコードブロックとして描くのでフェンスが要らず、
   * このリポジトリが書いていない文字列が記法として読まれることもありません。
   */
  | { readonly kind: "tool-output"; readonly text: string }
  /**
   * このリポジトリが組んだもの。画面ごとの表など。
   *
   * @remarks
   * そのまま描きます。升目に入るのは宣言が固定した名前とこのリポジトリが計算した数だけで、
   * 記法にはなりません。表であることに意味があるので、字下げして殺しません。
   */
  | { readonly kind: "authored"; readonly text: string };

/** {@link composeIssueBody} が受け取るもの。 */
export type IssueBodyInput = {
  /** 証拠の前に置く 1 行。表そのものが語る面では省きます。 */
  readonly heading?: string;
  /** 何が起きたかを示すもの。 */
  readonly evidence: IssueEvidence;
  /** 落ちた実行の URL。実行を指さない面では省きます。 */
  readonly runUrl?: string;
  /** 次にやることの案内。 */
  readonly note: string;
};

/** 道具の出力へ掛ける字下げ。 */
const TOOL_OUTPUT_INDENT = "    ";

/**
 * issue の本文を組み立てる。
 *
 * @param input - 見出し・証拠・実行の URL・案内
 * @returns markdown の本文
 */
export function composeIssueBody(input: IssueBodyInput): string {
  const blocks: string[] = [];

  if (input.heading !== undefined) {
    blocks.push(input.heading);
  }

  blocks.push(
    input.evidence.kind === "tool-output"
      ? input.evidence.text
          .split("\n")
          .map((line) => `${TOOL_OUTPUT_INDENT}${line}`)
          .join("\n")
      : input.evidence.text,
  );

  if (input.runUrl !== undefined) {
    blocks.push(`実行: ${input.runUrl}`);
  }

  blocks.push(input.note);

  return `${blocks.join("\n\n")}\n`;
}

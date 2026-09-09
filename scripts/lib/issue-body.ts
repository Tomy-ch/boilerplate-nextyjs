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
  | { readonly kind: "authored"; readonly text: string }
  /**
   * モデルが書いた散文。読解の節、統合が立てた関心など。
   *
   * @remarks
   * **散文のまま描きます。**字下げで殺すと、後段がこの本文を節として読み戻せなくなり
   * （週次は公開済みの issue から `## <節>` を拾い直す）、`#12` のような参照も死にます。
   * 道具の出力と違って、この散文は**読まれること自体が用途**です。
   *
   * 代わりに、公開の面で**取り消せない 2 つ**だけを潰します —— mention と、他スレッドを
   * 指す生のリンクです。どちらも上流へ通知や逆参照を残し、本文を後から直しても取り消せません
   * （`AGENTS.md`「Cross-Repository Links」）。見た目が崩れるだけの記法は潰しません。
   */
  | { readonly kind: "model-prose"; readonly text: string };

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
 * mention として解釈される綴り。
 *
 * @remarks
 * GitHub の利用者名は英数と `-` で、`-` は端に置けません。直前が語の文字・バッククォート・
 * `/` のときは外します —— メールアドレス、既にコードスパンへ入れたもの、パスの一部を
 * 二重に囲まないためです。
 */
const MENTION = /(^|[^\w`/])@([A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?)\b/g;

/** 他のスレッドを指す生のリンク。素で置くと、上流へ取り消せない逆参照が残る。 */
const THREAD_URL = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+\/(?:issues|pull)\/\d+)/g;

/**
 * このリポジトリが書いていない散文から、公開の面で取り消せないものだけを外す。
 *
 * @remarks
 * mention はコードスパンへ入れて通知を殺し、名前は読めるまま残します。他スレッドへの生の
 * リンクは `redirect.github.com` へ寄せます —— `github.com` の subdomain で同じ先へ 301 する
 * ので読み手には届き、GitHub は autolink しないので逆参照が残りません。
 *
 * **同じリポジトリを指す `#12` は触りません。**それは読み手に辿らせるための参照で、
 * このリポジトリの中に閉じています。
 *
 * @param text - このリポジトリが書いていない散文
 * @returns 公開の面へ載せてよい形
 */
export function drawModelProse(text: string): string {
  return text
    .replace(MENTION, (_match, before: string, name: string) => `${before}\`@${name}\``)
    .replace(THREAD_URL, "https://redirect.github.com/$1");
}

/** 出どころごとの描き方。呼ぶ側は出どころを渡すだけで、選び方はここが持つ。 */
function drawEvidence(evidence: IssueEvidence): string {
  switch (evidence.kind) {
    case "tool-output":
      return evidence.text
        .split("\n")
        .map((line) => `${TOOL_OUTPUT_INDENT}${line}`)
        .join("\n");
    case "model-prose":
      return drawModelProse(evidence.text);
    default:
      return evidence.text;
  }
}

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

  blocks.push(drawEvidence(input.evidence));

  if (input.runUrl !== undefined) {
    blocks.push(`実行: ${input.runUrl}`);
  }

  blocks.push(input.note);

  return `${blocks.join("\n\n")}\n`;
}

// 撤去の純ロジック。ファイル入出力と git は入口([index.ts](index.ts))が持つ。
//
// pin の孤児判定は宣言ではなく「撤去後に残る本文が参照しているか」を数える。宣言で持つと、同じ
// action を別の workflow が使い始めた日に宣言だけが古くなる —— `github/codeql-action` が実際に
// その形で、CodeQL を撤去しても他の 4 つが `upload-sarif` で使い続ける。

/**
 * pin のキーから `owner/repo` を取り出す。
 *
 * @remarks
 * `uses:` はサブパス付き（`github/codeql-action/upload-sarif`）でも書けるため、参照の有無は版を
 * 外した `owner/repo` で数えます。
 */
export function repoOf(key: string): string {
  const at = key.lastIndexOf("@");

  return at === -1 ? key : key.slice(0, at);
}

/** 撤去後に残る本文のどれかが、その action を参照していれば true。 */
export function isPinReferenced(action: string, survivingContents: readonly string[]): boolean {
  const repo = repoOf(action);

  return survivingContents.some((content) => content.includes(`uses: ${repo}`));
}

/** 文書 1 件に残った製品名。 */
export type Mention = {
  file: string;
  line: number;
  text: string;
};

/**
 * 撤去した製品の名前が残っている行を拾う。
 *
 * @remarks
 * **書き換えずに報告します。**複製したリポジトリは ADR も文書も上書きして使う前提なので、表の行
 * を完全一致で切り出す機構を持つと、行が動いた日に静かに素通りする側の危険だけが残ります。読み
 * 手が掃く先を挙げるほうが、掃いたことにして掃けていない状態より安全です。
 */
export function findMentions(
  file: string,
  content: string,
  patterns: readonly string[],
): readonly Mention[] {
  return content
    .split("\n")
    .map((text, index) => ({ file, line: index + 1, text }))
    .filter(({ text }) => patterns.some((pattern) => text.includes(pattern)));
}

// 撤去の純ロジック。ファイル入出力と git は入口([index.ts](index.ts))が持つ。
//
// pin の孤児判定は宣言ではなく「撤去後に残る本文が参照しているか」を数える。宣言で持つと、同じ
// action を別の workflow が使い始めた日に宣言だけが古くなる —— `github/codeql-action` が実際に
// その形で、CodeQL を撤去しても他の 4 つが `upload-sarif` で使い続ける。
//
// 文書の書き換えは**完全一致に限り、一致しなければ投げる**。行が動いたまま素通りすると、撤去した
// はずの製品が文書の中だけ生き残る。宣言が現物と一致することは
// [manifest のテスト](scanner-manifest.test.ts)が毎回見るので、ずれは**動かした PR の CI**で
// 落ちる —— 複製した側のセットアップまで持ち越さない。

/** 宣言した本文が現物に無いことを表す。 */
export class MissingDeclarationError extends Error {
  constructor(file: string, kind: string, needle: string) {
    super(`${file}: 宣言した${kind}が見つかりません（文書が動いた可能性があります）: ${needle}`);
    this.name = "MissingDeclarationError";
  }
}

/** 宣言した見出しが Markdown の見出しの形をしていないことを表す。 */
export class MalformedHeadingError extends Error {
  constructor(file: string, heading: string) {
    super(`${file}: 宣言した見出しが Markdown の見出しではありません: ${heading}`);
    this.name = "MalformedHeadingError";
  }
}

/**
 * 完全一致した最初の 1 箇所を、置換後の語句へ差し替える。
 *
 * @throws MissingDeclarationError 一致が無いとき。
 */
export function replaceExact(
  content: string,
  needle: string,
  replacement: string,
  file: string,
  kind: string,
): string {
  const at = content.indexOf(needle);

  if (at === -1) throw new MissingDeclarationError(file, kind, needle.trim().slice(0, 80));

  return content.slice(0, at) + replacement + content.slice(at + needle.length);
}

/**
 * 見出しと本文を、次の同レベル以上の見出しの直前まで落とす。
 *
 * @remarks
 * 見出しの手前の空行は残します。直前の要素との区切りであって消える節の持ち物ではなく、巻き込むと
 * 隣り合う 2 節を続けて消したときに区切りが尽きて markdownlint の MD022 を割ります。
 *
 * 見出しの形をしていない文字列は、本文に同じ行があっても受け付けません。level が決まらないまま
 * 続けると、どの見出しも境界と見なされず、宣言した行から本文の終端までを黙って落とします。
 *
 * @throws MalformedHeadingError 宣言が見出しの形をしていないとき。
 * @throws MissingDeclarationError 見出しが無いとき。
 */
export function removeSection(content: string, heading: string, file: string): string {
  const level = /^(#+)\s/.exec(heading)?.[1]?.length;

  if (level === undefined) throw new MalformedHeadingError(file, heading);

  const lines = content.split("\n");
  const start = lines.indexOf(heading);

  if (start === -1) throw new MissingDeclarationError(file, "見出し", heading);

  let end = lines.length;

  for (let i = start + 1; i < lines.length; i += 1) {
    const match = /^(#+)\s/.exec(lines[i] as string);

    if (match !== null && (match[1] as string).length <= level) {
      end = i;
      break;
    }
  }

  return [...lines.slice(0, start), ...lines.slice(end)].join("\n");
}

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

import { readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";

import { hasAnchor } from "./markdown-anchor";
import { groupsAt } from "./regex-groups";

/** 解決しなかったリンク 1 件。 */
export type BrokenLink = {
  /** リポジトリ相対のファイルパス。 */
  readonly file: string;
  /** そのファイルの中での行番号（1 始まり）。 */
  readonly line: number;
  /** 書かれていた相対リンク（アンカーを含む）。 */
  readonly href: string;
  /** 何が解決しなかったか。`path` はファイル、`anchor` は指し先の見出し。 */
  readonly reason: "anchor" | "path";
};

/**
 * インラインリンク 1 本。
 *
 * @remarks
 * `](path)` と `](<path>)` の両方を拾います。`<>` 囲みは `docs/spec/**` が `[id]` を含むパスに
 * 使っているので、落とすとその一群が丸ごと無検査になります。題名付き（`](path "title")`）は
 * 空白で切れるため、パスだけが残ります。
 *
 * **`(` `)` を含むパスは `<>` で囲む必要があります。** 囲まずに書くと最初の `)` で切れ、実在
 * するのに切れていると報告されます。囲みを要求するのは Markdown の記法そのものの制約で、
 * 括弧の対応を数える簡易パーサを持つより、記法に従わせるほうが読み手にも伝わります。
 *
 * **そのため囲みの中だけは `)` を通します。** 通さないと囲んでも同じ位置で切れ、
 * `src/app/(site-info)/**` のような route group を指すリンクが、書き手には打ちようが無いまま
 * 「実在しない」と報告され続けます。
 */
const LINK = /\]\(\s*(?:<([^<>\s]+)>|([^)<>\s]+))(?:\s+"[^"]*")?\s*\)/g;

/**
 * 参照形式リンクの定義行。
 *
 * @remarks
 * `[ref]: path "title"` の形。`](` を含まないため {@link LINK} には当たりません。使う側
 * （`[text][ref]`）はこの定義を経由するので、定義さえ見れば宛先は覆えます。
 */
const LINK_DEFINITION = /^\s*\[[^\]]+\]:\s*<?([^\s<>]+)>?/;

/** 相対リンクではないもの。URL・プロトコル相対・ルート絶対を外す。 */
const NOT_RELATIVE = /^([a-z][a-z0-9+.-]*:|\/)/i;

/** コードフェンスの開閉。 */
const FENCE = /^\s*(```|~~~)/;

/** 行頭がコメントである行（TSDoc の継続行と行コメント）。 */
const COMMENT_LINE = /^\s*(\*|\/\/|\/\*)/;

/**
 * 行の途中から始まる行コメント。
 *
 * @remarks
 * 文字列リテラルの中の `//` にも当たります。URL は {@link NOT_RELATIVE} が落とすので素通りし、
 * 残るのは「文字列の中に相対リンクの形を書いた行」だけです。**そちらへ倒してあります。**
 */
const TRAILING_COMMENT = /\/\/(.*)$/;

/**
 * リンクを探す対象の行だけを残す。行番号を保つため、外した行は空文字にして詰めない。
 *
 * @remarks
 * どちらもコードスパンを外します。外さないと、書き方そのものを示した例（バッククォートで
 * 囲んだリンクの形）を実在するリンクとして数えてしまいます。Markdown はコードフェンスも外します。
 *
 * ソースはコメントだけを見ます。文字列リテラルの中のリンクは、そのファイルからの相対ではなく
 * 生成先からの相対なので、同じ規則で解決すると誤って落ちます。行頭がコードでも、途中から
 * 始まる行コメントはコメントなので、その部分だけを取り出します。
 */
function scannableLines(file: string, content: string): string[] {
  const lines = content.split("\n");
  const withoutSpans = (line: string): string => line.replace(/`[^`]*`/g, "");

  if (extname(file) !== ".md") {
    return lines.map((line) => {
      if (COMMENT_LINE.test(line)) return withoutSpans(line);

      const trailing = TRAILING_COMMENT.exec(line)?.[1];

      return trailing === undefined ? "" : withoutSpans(trailing);
    });
  }

  // 閉じないフェンスを「そこから先ぜんぶコード」と読むと、**残りの行が丸ごと無検査になる**。
  // 見落としは無言なので、対応の取れない最後の開きは開きとして数えない。
  const fences = lines.flatMap((line, index) => (FENCE.test(line) ? [index] : []));
  const unclosed = fences.length % 2 === 1 ? fences.at(-1) : undefined;
  let inFence = false;

  return lines.map((line, index) => {
    if (FENCE.test(line) && index !== unclosed) {
      inFence = !inFence;

      return "";
    }

    return inFence ? "" : withoutSpans(line);
  });
}

/** その行に書かれた相対リンクをすべて取り出す。 */
function hrefsIn(text: string): string[] {
  const definition = LINK_DEFINITION.exec(text)?.[1];

  return [
    // 囲みと素書きは選択肢なので、参加したのはどちらか一方。
    ...[...text.matchAll(LINK)].map((match) => {
      const [bracketed, bare] = groupsAt(match, 1, 2);

      return bracketed || bare;
    }),
    ...(definition === undefined ? [] : [definition]),
  ];
}

/**
 * Markdown とソースの中から、解決しない相対リンクを拾う。
 *
 * @remarks
 * **段数を手で書く相対パスは、ファイルを動かした時点で静かに切れます。**型検査も lint も
 * 文字列の中までは見ないため、壊れても何も落ちません。読む人が辿って初めて気づく形になります。
 *
 * 指し先が Markdown なら、`#見出し` まで見ます。節の名前を変えたときに、それを指していた側が
 * どこにも現れないのは、パスが切れているのと同じことだからです。
 *
 * **リポジトリの外は見ません。** `../` を積めば木の外へ出られますが、外に何が在るかは書き手にも
 * 読み手にも意味を持たず、在ることを確かめられるだけで検査の外の事実がゲートの合否に混ざります。
 *
 * @param file - リポジトリ相対のファイルパス
 * @param content - そのファイルの中身
 * @param root - 相対パスを解決する起点（リポジトリルート）
 */
export function findBrokenDocLinks(file: string, content: string, root: string): BrokenLink[] {
  const broken: BrokenLink[] = [];

  scannableLines(file, content).forEach((text, index) => {
    for (const href of hrefsIn(text)) {
      if (NOT_RELATIVE.test(href)) continue;

      // `#` より前が指し先。見出しは `#` の直後の 1 区画。
      const hashAt = href.indexOf("#");
      const path = hashAt === -1 ? href : href.slice(0, hashAt);
      const [, fragment] = href.split("#");
      const target = path === "" ? resolve(root, file) : resolve(root, dirname(file), path);
      const line = index + 1;

      if (escapesRoot(root, target) || !exists(target)) {
        broken.push({ file, href, line, reason: "path" });
        continue;
      }

      if (!fragment) continue;
      if (extname(target) !== ".md") continue;

      // 在るかを確かめてから開くのではなく、開いて確かめる。2 度触ると、その間に消えた場合に
      // 「在ることになっているのに読めない」経路が生まれる。
      const markdown = readOf(target);

      if (markdown !== null && !hasAnchor(markdown, fragment)) {
        broken.push({ file, href, line, reason: "anchor" });
      }
    }
  });

  return broken;
}

/** 指し先が在るか。 */
function exists(target: string): boolean {
  try {
    statSync(target);

    return true;
  } catch {
    return false;
  }
}

/**
 * 指し先の中身。読めなければ null。
 *
 * @remarks
 * `.md` で終わる**ディレクトリ**もここへ来ます。名前だけでは中身が読めるかは決まらないので、
 * 開いて確かめます。
 */
function readOf(target: string): string | null {
  try {
    return readFileSync(target, "utf8");
  } catch {
    return null;
  }
}

/** 解決先がリポジトリの外か。 */
function escapesRoot(root: string, target: string): boolean {
  return relative(root, target).startsWith("..");
}

/** 見つかったものを、そのまま直せる形の文言にする。 */
export function formatBrokenDocLinks(broken: readonly BrokenLink[], root: string): string {
  return broken
    .map(
      ({ file, line, href, reason }) =>
        `${relative(root, resolve(root, file))}:${line}: ${href}（${
          reason === "path" ? "ファイルが無い" : "見出しが無い"
        }）`,
    )
    .join("\n");
}

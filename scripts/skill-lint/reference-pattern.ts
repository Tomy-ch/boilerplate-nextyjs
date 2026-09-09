/**
 * 参照文字列の照合に使う判定。
 *
 * @remarks
 * ファイル走査と報告は入口が持ちます。ここは「その表記が何に当たるか」を導くところだけを
 * 持ちます。上限を超えた表記の扱いは {@link isTooComplex} の上限定義が持ちます。
 */
// 参照 1 件あたりのワイルドカード数とブレース展開数の上限。
// 参照文字列は Markdown 本文から取るため書き手が自由に決められ、pre-commit と CI は時間制限なしで
// このスクリプトを回す。`*` を並べた参照は `.*` の連鎖になり、索引全件との照合で破局的バックトラッキングを
// 起こす。`{a,b}` の並びは組み合わせ爆発を起こす。上限超過は検査を飛ばさず違反として報告する
// （黙って通すと「複雑に書けば検査を外せる」抜け道になる）。
const MAX_WILDCARDS = 8;
const MAX_BRACE_EXPANSIONS = 64;

export function isTooComplex(text: string): boolean {
  const wildcards = text.match(/\*+|<[^>]*>/g)?.length ?? 0;
  if (wildcards > MAX_WILDCARDS) return true;
  const combinations = (text.match(/\{[^{}]*\}/g) ?? []).reduce(
    (n, group) => n * Math.max(1, group.split(",").length),
    1,
  );
  return combinations > MAX_BRACE_EXPANSIONS;
}

// `{a,b}` を展開して候補文字列の配列にする。
// make ターゲットでは実ターゲット名の列挙（全て実在すべき）、パスでは glob の選択（どれか 1 つ
// 当たれば良い）と意味が異なるため、判定側で all / any を使い分ける。
export function expandBraces(text: string): string[] {
  const m = /\{([^{}]*)\}/.exec(text);
  const alternatives = m?.[1];
  if (m === null || alternatives === undefined) return [text];
  return alternatives
    .split(",")
    .flatMap((alt) =>
      expandBraces(text.slice(0, m.index) + alt + text.slice(m.index + m[0].length)),
    );
}

export const WILDCARD_RE = /[*<]/;

// ドキュメント中のプレースホルダ表記を正規表現へ変換する。
// `<name>` は書き手が埋める任意の 1 セグメント、`**` は任意階層、`*` は 1 セグメント内の任意文字列。
export function placeholderToRegExp(
  text: string,
  { segmentSeparator }: { segmentSeparator: boolean },
): RegExp {
  const anySegmentChars = segmentSeparator ? "[^/]*" : ".*";
  const placeholderChars = segmentSeparator ? "[^/]+" : ".+";
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === "<") {
      const close = text.indexOf(">", i);
      if (close === -1) {
        out += "<";
        continue;
      }
      out += placeholderChars;
      i = close;
      continue;
    }
    if (ch === "*") {
      // 連続する `*` は 1 つのワイルドカードとして扱う。1 個ずつ `.*` へ展開すると `.*` の連鎖ができ、
      // 照合が破局的バックトラッキングに落ちる。
      let run = 1;
      while (text[i + run] === "*") run++;
      i += run - 1;
      if (segmentSeparator && run >= 2) {
        if (text[i + 1] === "/") {
          out += "(?:[^/]+/)*";
          i++;
        } else {
          out += ".*";
        }
        continue;
      }
      out += anySegmentChars;
      continue;
    }
    out += ch.replace(/[.+^${}()|[\]\\?]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

// 1 行をインラインコードスパンの中身（spans）とスパンを除いた残り（withoutCode）へ分解する。
// 閉じ判定は CommonMark どおり「開きと同じ長さのバッククォート列」に限る。長さを見ないと、単一
// バッククォートを含む語句を二重で囲む書き方（`` `x` ``）が内側の 1 個で閉じたと解釈され、コード
// スパンの中身が地の文として漏れる。
// 抽出と除去を 1 つの走査で持つのは、解釈が食い違うと同じ記述が一方の検査では例示・他方では実在の
// 主張になるため。走査は 1 パスで、正規表現の後方参照のようなバックトラッキングを持たない。

export function scanInlineCode(line: string): { spans: string[]; withoutCode: string } {
  const spans: string[] = [];
  let withoutCode = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] !== "`") {
      withoutCode += line[i];
      i++;
      continue;
    }
    let open = 0;
    while (line[i + open] === "`") open++;
    let close = -1;
    for (let j = i + open; j < line.length; ) {
      if (line[j] !== "`") {
        j++;
        continue;
      }
      let run = 0;
      while (line[j + run] === "`") run++;
      if (run === open) {
        close = j;
        break;
      }
      j += run;
    }
    // 閉じないバッククォート列はコードスパンを開いていない。地の文として残す。
    if (close === -1) {
      withoutCode += line.slice(i, i + open);
      i += open;
      continue;
    }
    spans.push(line.slice(i + open, close).trim());
    i = close + open;
  }
  return { spans, withoutCode };
}

// ---------------------------------------------------------------------------
// frontmatter
// ---------------------------------------------------------------------------

// 先頭の `---` で囲まれた frontmatter を切り出す。無ければ null。

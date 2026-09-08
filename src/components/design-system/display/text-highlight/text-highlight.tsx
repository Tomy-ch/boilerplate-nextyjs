import type { ComponentProps } from "react";
import { Fragment } from "react";

import { cn } from "@/components/cn";

const REGEXP_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(term: string): string {
  return term.replace(REGEXP_METACHARACTERS, "\\$&");
}

type TextSegment = {
  key: string;
  matched: boolean;
  value: string;
};

/**
 * 本文を、一致した区間と一致しない区間へ順番どおりに切り分ける。
 *
 * key には本文中の開始位置を使う。同じ本文と語であれば描画のたびに同じ key になり、
 * 一致箇所の増減があっても既存の区間が別物として作り直されない。
 */
function splitByMatches(
  text: string,
  terms: readonly string[],
  caseSensitive: boolean,
): TextSegment[] {
  const patterns = terms.filter((term) => term.length > 0).map(escapeRegExp);
  if (patterns.length === 0) {
    return [{ key: "0", matched: false, value: text }];
  }

  const matcher = new RegExp(patterns.join("|"), caseSensitive ? "g" : "gi");
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(matcher)) {
    if (match.index > cursor) {
      segments.push({
        key: String(cursor),
        matched: false,
        value: text.slice(cursor, match.index),
      });
    }
    segments.push({ key: String(match.index), matched: true, value: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ key: String(cursor), matched: false, value: text.slice(cursor) });
  }

  return segments;
}

/** {@link TextHighlight} の props。 */
export type TextHighlightProps = Omit<ComponentProps<"span">, "children"> & {
  /** 大文字小文字を区別して一致を判定するか。既定は区別しない。 */
  caseSensitive?: boolean;
  /**
   * 強調する語。複数渡した場合は、いずれかに一致した区間をすべて強調する。
   *
   * 空文字と空配列は「強調しない」を表し、本文をそのまま表示する。
   */
  query: string | readonly string[];
  /** 強調対象の本文。 */
  text: string;
};

/**
 * 本文のうち指定した語に一致する区間を、native `mark` で強調して表示する。
 *
 * @remarks
 * 検索キーワードが本文のどこに当たったかを示す用途に使う。一致判定は既定で大文字小文字を
 * 区別せず、`caseSensitive` で切り替える。`query` に配列を渡すと、いずれかの語に一致した
 * 区間をすべて強調する。語に正規表現の記号が含まれていても、文字そのものとして扱う。
 *
 * 検索語の分割、正規化、一致件数の集計は行わない。どの語を渡すかは呼び出し元が決める。
 *
 * この部品は state や browser API を持たないため、Server Component と Client Component の
 * どちらからも利用できる。
 *
 * `text` は文字列としてのみ扱い、HTML として解釈しない。sanitize 済みの本文を組版する用途には
 * `Typeset` を使う。
 *
 * `mark` は「文脈上いま注目に値する区間」を表す要素であり、語そのものの重要性を表す `strong` や
 * `em` とは意味が異なる。強調が視覚的な手掛かりでしかない場合でも、本文の読み上げ内容は
 * 変わらないため、一致件数や検索条件を利用者へ伝える必要があるときは、別途テキストで示す。
 *
 * @example
 * ```tsx
 * <TextHighlight query={keyword} text={item.name} />
 *
 * <TextHighlight caseSensitive query={["ID", "Key"]} text={item.description} />
 * ```
 *
 * @param props - native `span` 属性と、以下の表示用 props。`children` は受け取らない。
 * @param props.text - 強調対象の本文。
 * @param props.query - 強調する語。
 * @param props.caseSensitive - 大文字小文字を区別して一致を判定するか。
 * @see Storybook `Display/TextHighlight`
 */
export function TextHighlight({
  caseSensitive = false,
  className,
  query,
  text,
  ...props
}: TextHighlightProps) {
  const terms = typeof query === "string" ? [query] : query;
  const segments = splitByMatches(text, terms, caseSensitive);

  return (
    <span className={cn(className)} data-slot="text-highlight" {...props}>
      {segments.map((segment) =>
        segment.matched ? (
          <mark
            className="rounded-sm bg-accent px-0.5 text-accent-foreground"
            data-slot="text-highlight-match"
            key={segment.key}
          >
            {segment.value}
          </mark>
        ) : (
          <Fragment key={segment.key}>{segment.value}</Fragment>
        ),
      )}
    </span>
  );
}

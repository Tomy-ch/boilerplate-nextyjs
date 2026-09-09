import type { Nodes, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { sanitize } from "hast-util-sanitize";

import { RICH_TEXT_SANITIZE_SCHEMA } from "./rich-text.definition";

/**
 * hast のノードを root ノードへ揃えます。
 *
 * sanitize の戻り値はノード種別の union であり、root 以外を返しうる型を持ちます。描画側が常に
 * root を受け取れるよう、root 以外は root の子として包みます。
 *
 * @param node - 揃える対象のノード
 * @returns 与えたノードを内容とする root ノード
 */
export function toRichTextRoot(node: Nodes): Root {
  return node.type === "root" ? node : { type: "root", children: [node] };
}

/** protocol-relative URL を落とす対象の属性です。 */
const URL_PROPERTY_NAMES: ReadonlySet<string> = new Set(["href", "src"]);

/**
 * protocol-relative URL（`//host`）を属性から落とします。
 *
 * `hast-util-sanitize` の protocol 検査は `:` を含む値のスキームだけを見るため、`//host` は
 * 相対参照として素通りします。実体は閲覧中のページと同じ protocol で解決される外部ホストへの
 * 絶対 URL であり、内部パスに見せかけた誘導になるので sanitize の後段で落とします。
 *
 * @param node - 検査対象のノード。木を破壊的に書き換えます
 */
function dropProtocolRelativeUrls(node: Nodes): void {
  if (node.type === "element") {
    node.properties = Object.fromEntries(
      Object.entries(node.properties).filter(
        ([name, value]) =>
          !(URL_PROPERTY_NAMES.has(name) && typeof value === "string" && value.startsWith("//")),
      ),
    );
  }

  if ("children" in node) {
    for (const child of node.children) {
      dropProtocolRelativeUrls(child);
    }
  }
}

/**
 * sanitize 済みのリッチテキストを表す Value Object です。
 *
 * 構築経路を {@link SanitizedRichText.from} だけに絞ることで、sanitize を通っていない HTML が
 * この型として流通しえない状態を型で保証します。描画側はこの型だけを受け取り、HTML 文字列を
 * 受け取りません。
 *
 * @remarks
 * class instance は serializable ではないため、Client Component の props へ直接渡せません。
 * 渡す必要が生じた場合は {@link SanitizedRichText.root} を取り出すことになりますが、その時点で
 * 「sanitize 済みである」ことの型保証は失われます。
 *
 * @example
 * ```ts
 * import { SanitizedRichText } from "@/model/rich-text/sanitized-rich-text";
 *
 * const content = SanitizedRichText.from("<p>本文<script>alert(1)</script></p>");
 * ```
 */
export class SanitizedRichText {
  /**
   * sanitize 済みの hast root ノードです。
   *
   * {@link RICH_TEXT_SANITIZE_SCHEMA} が通したタグと属性だけを含みます。
   */
  readonly root: Root;

  private constructor(root: Root) {
    this.root = root;
  }

  /**
   * HTML 文字列を parse して sanitize し、Value Object を構築します。
   *
   * parse は fragment として行うため、`html` / `head` / `body` は補われません。不正な入れ子は parse の
   * 段階で正規化され、例外にはなりません。検査の方式は同層の README「実装の要点」が持ちます。
   *
   * @param html - 未検査の HTML 文字列
   * @returns allowlist の範囲だけを残した {@link SanitizedRichText}
   */
  static from(html: string): SanitizedRichText {
    const parsed = fromHtml(html, { fragment: true });
    const sanitized = toRichTextRoot(sanitize(parsed, RICH_TEXT_SANITIZE_SCHEMA));

    dropProtocolRelativeUrls(sanitized);

    return new SanitizedRichText(sanitized);
  }

  /**
   * markup を落とした平文です。
   *
   * meta description や構造化データのように、markup を置けない場所へ渡します。段落や改行の
   * 区切りは持たず、text ノードをそのまま繋いだものです。
   */
  get text(): string {
    return collectText(this.root);
  }
}

/** 木の text ノードを文書順に繋ぐ。 */
function collectText(node: Nodes): string {
  const own = node.type === "text" ? node.value : "";
  const inner = "children" in node ? node.children.map(collectText).join("") : "";

  return own + inner;
}

/**
 * 公開面（クローラが読むもの）の応答から、確かめたい値を取り出す。
 *
 * @remarks
 * 文書を DOM に組み立てず文字列のまま読むのは、確かめる相手が**配信された文字列そのもの**である
 * ためです。metadata は殻の後から流れて `<body>` の末尾に足されることがあり
 * （`generateMetadata` のストリーミング）、`<head>` だけを見ると取りこぼします。
 */

/** `<loc>` の中身を XML の実体から戻す。sitemap が持つのは URL なので、この 5 つで足りる。 */
function unescapeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

/**
 * sitemap が挙げる URL を、書かれた順に返す。
 *
 * @param xml - `sitemap.xml` の本文
 */
export function listSitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].flatMap(([, location]) =>
    location === undefined ? [] : [unescapeXml(location)],
  );
}

/**
 * タグの属性を、名前を小文字にして並べる。
 *
 * @remarks
 * 読む相手は React が直列化した HTML で、属性は常に `name="value"` の綴りで出ます。値は `"` で
 * 囲まれるので、`"` で切った偶数番目の末尾が `name=` になります。正規表現で名前を拾わないのは、
 * `+` の照合が後戻りを持ち、長いタグで所要時間が伸びるためです。
 */
function attributesOf(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const parts = tag.split('"');

  for (let index = 1; index < parts.length; index += 2) {
    const before = parts[index - 1]?.trimEnd();
    const value = parts[index];

    if (before === undefined || value === undefined || !before.endsWith("=")) {
      continue;
    }

    const name = before.slice(0, -1).split(/[\s<]+/).at(-1);

    if (name === undefined) {
      continue;
    }

    attributes.set(name.toLowerCase(), value);
  }

  return attributes;
}

/** 文書中の `<link>` を、属性の並びで返す。 */
function listLinks(html: string): Map<string, string>[] {
  return [...html.matchAll(/<link\b[^>]*>/g)].map((match) => attributesOf(match[0]));
}

/** 文書中の `<meta>` を、属性の並びで返す。 */
function listMetas(html: string): Map<string, string>[] {
  return [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => attributesOf(match[0]));
}

/**
 * 文書が名乗る正規 URL。無ければ null。
 *
 * @param html - 画面の本文
 */
export function findCanonicalHref(html: string): string | null {
  const canonical = listLinks(html).find((link) => link.get("rel") === "canonical");

  return canonical?.get("href") ?? null;
}

/**
 * 文書が名乗る Open Graph の値。無ければ null。
 *
 * @param html - 画面の本文
 * @param property - `og:image` のような property 名
 */
export function findOpenGraphContent(html: string, property: string): string | null {
  const meta = listMetas(html).find((entry) => entry.get("property") === property);

  return meta?.get("content") ?? null;
}

/**
 * 文書が名乗る OG 画像の URL。無ければ null。
 *
 * @param html - 画面の本文
 */
export function findOpenGraphImage(html: string): string | null {
  return findOpenGraphContent(html, "og:image");
}

/** アイコンとして読まれる `rel`。 */
const ICON_RELS: ReadonlySet<string> = new Set(["icon", "apple-touch-icon"]);

/**
 * 文書が名乗るアイコンの URL を、書かれた順に返す。
 *
 * @param html - 画面の本文
 */
export function listIconHrefs(html: string): string[] {
  return listLinks(html)
    .filter((link) => ICON_RELS.has(link.get("rel") ?? ""))
    .map((link) => link.get("href") ?? "")
    .filter((href) => href !== "");
}

/**
 * 文書が索引を断っているか（`<meta name="robots">` に `noindex` を含むか）。
 *
 * @param html - 画面の本文
 */
export function isNoindex(html: string): boolean {
  return listMetas(html).some(
    (meta) =>
      meta.get("name") === "robots" &&
      (meta.get("content") ?? "")
        .split(",")
        .map((directive) => directive.trim())
        .includes("noindex"),
  );
}

/**
 * 2 つの URL が同じ場所を指すか。
 *
 * @remarks
 * 綴りではなく解決した形で比べます。sitemap は root を `https://a.test/` と書き、Next.js の
 * canonical は `metadataBase` に `/` を足した結果を `https://a.test` と出すため、文字列では
 * 一致しません。
 *
 * @param left - 比べる URL
 * @param right - 比べる URL
 */
export function isSameLocation(left: string, right: string): boolean {
  return new URL(left).href === new URL(right).href;
}

/**
 * `robots.txt` の本文から、指定した field の値を書かれた順に返す。
 *
 * @param text - `robots.txt` の本文
 * @param field - `Disallow` / `Allow` / `Sitemap` など。綴りの大小は区別しない
 */
export function listRobotsDirectives(text: string, field: string): string[] {
  const wanted = field.toLowerCase();

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line !== "")
    .flatMap((line) => {
      const separator = line.indexOf(":");

      if (separator === -1 || line.slice(0, separator).trim().toLowerCase() !== wanted) {
        return [];
      }

      return [line.slice(separator + 1).trim()];
    });
}

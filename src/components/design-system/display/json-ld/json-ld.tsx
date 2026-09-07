/** `JsonLd` の props。 */
export type JsonLdProps = {
  /** schema.org の語彙で組み立てた構造化データ。`@context` と `@type` を含む 1 つの object。 */
  readonly data: Readonly<Record<string, unknown>>;
};

/**
 * 構造化データを `<script type="application/ld+json">` として埋め込む。
 *
 * @remarks
 * 出力は JSON であって HTML ではないので、`<` を `\\u003c` へ逃がします。JSON の文字列の中に
 * `</script>` が入ると、ブラウザはそこで script を閉じ、続きを HTML として読みます —— 値の出所が
 * バックエンドである以上、その中身を前提にできません。`\\u003c` は JSON として `<` と同じ値で、
 * 検索エンジンの読み取りは変わりません。
 *
 * 何を入れるか（schema.org の type と項目）は画面の判断で、この component は持ちません。
 * Server Component として使えます。hydration は不要です。
 *
 * @example
 * ```tsx
 * import { JsonLd } from "@/components/design-system/display/json-ld/json-ld";
 *
 * <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", name: "Acme" }} />
 * ```
 *
 * @param props - 構造化データ
 * @param props.data - schema.org の語彙で組み立てた 1 つの object
 * @see Storybook `Display/JsonLd`
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON を script の本文として埋め込む唯一の口。`<` は上で逃がしてある
      dangerouslySetInnerHTML={{ __html: toJsonLdScriptContent(data) }}
    />
  );
}

/**
 * script の本文に置ける形へ直列化する。
 *
 * @param data - 構造化データ
 */
export function toJsonLdScriptContent(data: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(data).replaceAll("<", String.raw`\u003c`);
}

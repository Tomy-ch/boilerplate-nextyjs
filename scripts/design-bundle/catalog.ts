/**
 * bundle に載せる目録の組み立て。
 *
 * @remarks
 * ファイル入出力と shadcn CLI の呼び出しは入口が持ちます。ここは読み取り済みの Markdown と
 * 収集済みの component から、送り先が読む形を導くところだけを持ちます。
 */

const REGISTRY_ITEM_TYPE = {
  /** 契約を知らない基礎部品。土台として残る */
  UI: "registry:ui",
  /** 契約や画面骨格を前提にする部品。作り替える前提 */
  COMPONENT: "registry:component",
} as const;

/** 実装ではないファイル。registry には載せない。 */
const EXCLUDED_SUFFIXES = [".test.ts", ".test.tsx", "README.md"] as const;
/** bundle に載せる component 1 件。 */
export type BundleComponent = {
  name: string;
  title: string;
  layer: string;
  as: string;
  directory: string;
  /** README の「用途」節。1 行で何のための部品かを表す */
  purpose: string;
  /** README の「責務境界」節。この部品が持たないもの */
  boundary: string;
  files: string[];
  stories: { id: string; name: string }[];
};

/** `## 見出し` の直後から次の見出しの手前までを、1 行へ畳んで返す。 */
export function sectionOf(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return "";

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));

  return (end === -1 ? rest : rest.slice(0, end))
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join(" ");
}

/** README の先頭見出しを component の表示名として使う。 */
export function titleOf(markdown: string, fallback: string): string {
  return /^# (.+)$/m.exec(markdown)?.[1]?.trim() ?? fallback;
}

/** `design-system` の部品だけを `registry:ui` とし、それ以外の層は `registry:component` にする。 */
export function itemTypeOf(layer: string): string {
  return layer === "design-system" ? REGISTRY_ITEM_TYPE.UI : REGISTRY_ITEM_TYPE.COMPONENT;
}

/** component ディレクトリ直下の実装ファイルを、registry へ載せる順で返す。 */
export function bundledFilesOf(entries: readonly string[]): string[] {
  return entries
    .filter((entry) => !EXCLUDED_SUFFIXES.some((suffix) => entry.endsWith(suffix)))
    .sort();
}

/** 目録を Markdown で組み立てる。送り先が人でも AI でも、まずこれを読めば全体が分かる。 */
export function renderCatalog(components: readonly BundleComponent[]): string {
  const byLayer = new Map<string, BundleComponent[]>();
  for (const component of components) {
    byLayer.set(component.layer, [...(byLayer.get(component.layer) ?? []), component]);
  }

  const lines = [
    "# デザインシステム目録",
    "",
    "このリポジトリが持つ component の全件です。`r/` の registry がソースを、`tokens.css` が",
    "色・余白などの semantic token を持ちます。**参照は一方向で、ここから作った成果物を",
    "リポジトリへ自動で戻す経路はありません。**",
    "",
  ];

  for (const [layer, items] of [...byLayer].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`## ${layer}`, "");
    for (const component of items.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`### ${component.title}`, "");
      lines.push(`- 見出し: ${component.as}`, `- 置き場: ${component.directory}`);
      if (component.purpose !== "") lines.push(`- 用途: ${component.purpose}`);
      if (component.boundary !== "") lines.push(`- 持たないもの: ${component.boundary}`);
      if (component.stories.length > 0) {
        lines.push(`- story: ${component.stories.map((story) => story.name).join(" / ")}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

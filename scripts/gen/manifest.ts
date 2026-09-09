import { isMap, parseDocument } from "yaml";
import { componentDirectoryOf } from "../../src/components/scripts/check-shadcn";
import type { ComponentPlacement } from "./plan";

/**
 * 生成した component を `shadcn-manifest.yaml` へ記録する。
 *
 * @remarks
 * `README.md` を持つディレクトリは台帳に行が無いと `pnpm check:ui` が落とすため、雛形は台帳の行と
 * 対で出します。上流を持たない部品なので `kind` は `original` で、`registryItem` と `source` は
 * 持ちません。
 */

/** 上流を持たない component の台帳の行。 */
export type OriginalComponentEntry = {
  readonly kind: "original";
  readonly layer: ComponentPlacement["layer"];
  readonly as: ComponentPlacement["as"];
  readonly directory: string;
  readonly addedAt: string;
};

/** 台帳へ足す行を組み立てる。`directory` は層と見出しから導き、`pnpm check:ui` の期待と一致させる。 */
export function componentManifestEntry(
  name: string,
  placement: ComponentPlacement,
  addedAt: string,
): OriginalComponentEntry {
  return {
    kind: "original",
    layer: placement.layer,
    as: placement.as,
    directory: componentDirectoryOf(placement.layer, placement.as, name),
    addedAt,
  };
}

/** 台帳に同じ key の行が既に在るかを返す。 */
export function isRecorded(manifestSource: string, name: string): boolean {
  return parseDocument(manifestSource).hasIn(["components", name]);
}

/**
 * 台帳の末尾へ 1 行足した全文を返す。
 *
 * @remarks
 * 既存の行は書き戻さず、対象の 1 件だけを差し込みます。文書ごと再シリアライズすると、台帳が
 * 持つ判断の経緯コメントが消えるためです。
 */
export function recordComponent(
  manifestSource: string,
  name: string,
  entry: OriginalComponentEntry,
): string {
  const document = parseDocument(manifestSource);

  document.setIn(["components", name], document.createNode(entry));

  // 空の台帳は `components: {}` と flow 形式で書かれうる。そこへ足すと以降も flow のまま
  // 1 行に潰れて読めなくなるため、block 形式へ戻す。
  const components = document.get("components");
  /* istanbul ignore next -- setIn が map を作った直後なので map 以外にはならない。TS の絞り込みのためだけの分岐。 */
  if (isMap(components)) components.flow = false;

  return document.toString();
}

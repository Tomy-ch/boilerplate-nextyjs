import {
  COMPONENT_LAYER,
  catalogHeadingSchema,
  componentLayerSchema,
} from "../../src/components/scripts/check-shadcn";
import { optionValue } from "./option-value";
import type { ComponentPlacement } from "./plan";

/**
 * `pnpm gen component` の配置オプションを、台帳と同じ語彙で読む。
 *
 * @remarks
 * `--as=<見出し>` / `--layer=<層>` の形と既定値は `pnpm add:ui` と同じにしてあります。
 * 置き場を決める軸が 2 本あるのは台帳の宣言と同じで、見出しは目的、層は誰が書き換えるかです。
 * 値の集合は `check-shadcn.ts` の schema から実行時に引くので、見出しや層が増えてもここは
 * 直しません。
 */

const AS_OPTION = "--as";
const LAYER_OPTION = "--layer";

/** 読み取りの結果。配置が定まったか、利用者へ見せる 1 行か。 */
export type PlacementResult =
  | { readonly placement: ComponentPlacement }
  | { readonly error: string };

/**
 * オプション列から、component を置く層と見出しを決める。
 *
 * @param options - `<name>` より後ろの引数。`--as=<見出し>` は必須、`--layer=<層>` の既定は `design-system`。
 */
export function readComponentPlacement(options: readonly string[]): PlacementResult {
  const unknown = options.find(
    (argument) => !argument.startsWith(`${AS_OPTION}=`) && !argument.startsWith(`${LAYER_OPTION}=`),
  );

  if (unknown !== undefined) {
    return {
      error: `引数 "${unknown}" は受け付けません。配置は ${AS_OPTION}=<見出し> と ${LAYER_OPTION}=<層> で指定してください。`,
    };
  }

  const as = catalogHeadingSchema.safeParse(optionValue(options, AS_OPTION));

  if (!as.success) {
    return {
      error: `${AS_OPTION}=<見出し> は必須です。見出しは ${catalogHeadingSchema.options.join(" / ")} のいずれかです。`,
    };
  }

  const layer = componentLayerSchema.safeParse(
    optionValue(options, LAYER_OPTION) ?? COMPONENT_LAYER.DESIGN_SYSTEM,
  );

  if (!layer.success) {
    return {
      error: `${LAYER_OPTION}=<層> は ${componentLayerSchema.options.join(" / ")} のいずれかです。`,
    };
  }

  return { placement: { layer: layer.data, as: as.data } };
}

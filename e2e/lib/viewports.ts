// 画面を撮る帯（viewport の幅）の宣言。
//
// 帯そのものは 3 つに固定されており、境界の値は design token（`tokens/primitives.json`）が持つ
// （[README](../README.md)「帯とエンジンは宣言から引く」）。ここに数値を書かないのは、token を
// 差し替えた先で、レイアウトの分岐と撮影の幅が別々に動き始めるためである。
import { readFileSync } from "node:fs";

/** ブレークポイントの宣言を持つ design token。 */
const TOKENS_FILE = "tokens/primitives.json";

/**
 * `rem` を px へ直すときの根の font-size。
 *
 * @remarks
 * CSS の初期値であり、`html` の `font-size` を上書きしていない限りこの値になります
 * （`src/app/globals.css`）。上書きすると Tailwind のブレークポイントも一緒に動くため、
 * 上書きする側がここも動かすことになります。
 */
const ROOT_FONT_SIZE_PX = 16;

/** 撮る帯 1 つ。 */
export type Band = {
  /** 基準画像を分ける区画の名前。 */
  readonly name: string;
  /** 撮影する幅（px）。 */
  readonly width: number;
};

/**
 * token の `dimension` を px へ直す。
 *
 * @remarks
 * 受け付けるのは `rem` と `px` だけです。ブレークポイントに他の単位が現れたら、それは viewport の
 * 幅として比較できる値ではないので落とします。
 */
export function toPixels(value: string): number {
  const match = /^(-?\d+(?:\.\d+)?)(rem|px)$/.exec(value);

  if (match === null) {
    throw new Error(`ブレークポイントとして読めない値です: ${value}`);
  }

  const amount = Number(match[1]);

  return match[2] === "px" ? amount : amount * ROOT_FONT_SIZE_PX;
}

type TokenLeaf = { $value?: unknown };
type TokenTree = { breakpoint?: unknown };

/**
 * design token の宣言からブレークポイントを取り出す。
 *
 * @remarks
 * 宣言が無い、あるいは空だった場合は例外を投げます。0 件へ縮退させると、帯を 1 つも持たない
 * 実行が「差分なし」として緑で通ります。
 */
export function parseBreakpoints(json: string): ReadonlyMap<string, number> {
  const breakpoint = (JSON.parse(json) as TokenTree).breakpoint;

  if (typeof breakpoint !== "object" || breakpoint === null) {
    throw new Error(`${TOKENS_FILE} に breakpoint がありません`);
  }

  const parsed = new Map<string, number>();

  for (const [name, leaf] of Object.entries(breakpoint as Record<string, TokenLeaf>)) {
    if (typeof leaf?.$value === "string") {
      parsed.set(name, toPixels(leaf.$value));
    }
  }

  if (parsed.size === 0) {
    throw new Error(`${TOKENS_FILE} の breakpoint に値がありません`);
  }

  return parsed;
}

/** 帯の境界として読むブレークポイントの名前。 */
const BAND_EDGES = ["md", "lg"] as const;

/**
 * 3 段の帯と、各段で撮る幅を組み立てる。
 *
 * @remarks
 * `md` 未満がモバイル、`md` 以上 `lg` 未満がタブレット、`lg` 以上が PC です。
 *
 * 撮るのは**帯の下端**です。レイアウトは mobile-first の `min-width` で切り替わるので、下端は
 * その帯の指定が初めて効く幅であり、崩れるならまずそこで崩れます。PC で常設する脇の領域が
 * 最も本文を圧迫するのも `lg` ちょうどです。
 *
 * モバイルだけは下端を token が持ちません（対応する下限は用途依存として委ねて
 * います）。代わりに上端（`md - 1`）を撮ります。この帯は幅が広いほど余白が伸びるため、崩れると
 * すれば上端です。
 */
export function responsiveBands(breakpoints: ReadonlyMap<string, number>): readonly Band[] {
  const missing = BAND_EDGES.filter((edge) => !breakpoints.has(edge));

  if (missing.length > 0) {
    throw new Error(`帯の境界にするブレークポイントがありません: ${missing.join(", ")}`);
  }

  const md = breakpoints.get("md") as number;
  const lg = breakpoints.get("lg") as number;

  return [
    { name: "mobile", width: md - 1 },
    { name: "tablet", width: md },
    { name: "desktop", width: lg },
  ];
}

/**
 * 撮影・巡回する高さ。
 *
 * @remarks
 * 帯を決めるのは幅だけです。高さは story 単位の撮影（`playwright.config.ts`）と同じ値に
 * 揃えてあります。画面は全体を撮るので、収まらない分は縦に伸びます。
 */
export const VIEWPORT_HEIGHT = 720;

/** design token の宣言を読む。 */
export function loadBreakpoints(): ReadonlyMap<string, number> {
  return parseBreakpoints(readFileSync(TOKENS_FILE, "utf8"));
}

/** design token を読んで帯を組み立てる。 */
export function loadBands(): readonly Band[] {
  return responsiveBands(loadBreakpoints());
}

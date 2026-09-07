/**
 * 差分の量から、先送りにした検査を「この PR で回しておくべき」と知らせるかを決める。
 *
 * @remarks
 * **構造から名指しできなかったときの予備です**（[`recommend.ts`](recommend.ts)）。どの検査が要る
 * かを言えないまま「大きい」とだけ言うので、根拠のある線は引けません。
 */
import type { Change } from "../lib/numstat";
import { movesResult } from "./subject";

/**
 * 量に数えるパス。
 *
 * @remarks
 * 先送りにした 3 つの検査が見るものが集まっているディレクトリです。`src/` は描画とロジック、
 * `tokens/` は配色と寸法、`.storybook/` は story の写り方、`e2e/` と `vrt/` は検査そのものの実装。
 *
 * **和集合ではありません** —— [`recommend.ts`](recommend.ts) が名指しする入力には `next.config.ts`
 * のようにここへ入らないものもあります。ここが答えるのは「名指しできないほど広い差分か」で、
 * 設定ファイル 1 本の変更が 400 行の線を越えることはないためです。
 *
 * `mocks/` が入るのは、`e2e` と `lighthouse` が実アプリを mock モード（`APP_ENV=ci`）で起動し、
 * 応答がそのまま画面の中身になるためです。**story はここを通りません** —— カタログが自分で答える
 * ハンドラは `.storybook/msw/` にあります（`mocks/README.md`）。3 つのうち 2 つが見る、で足ります。
 */
const COUNTED_PREFIXES: readonly string[] = [
  "src/",
  "tokens/",
  ".storybook/",
  "mocks/",
  "e2e/",
  "vrt/",
] as const;

/** 量に数えるパスか。 */
export function isCounted(path: string): boolean {
  return COUNTED_PREFIXES.some((prefix) => path.startsWith(prefix)) && movesResult(path);
}

/** 数える対象の変更行数を合計する。 */
export function countChangedLines(changes: readonly Change[]): number {
  return changes
    .filter((change) => isCounted(change.path))
    .reduce((total, change) => total + change.changedLines, 0);
}

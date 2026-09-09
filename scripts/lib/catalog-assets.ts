import { existsSync } from "node:fs";
import { posix, resolve } from "node:path";

import { groupAt } from "./regex-groups";

/** なぜ解決しないか。 */
type AssetFailure =
  /** 配信の根のどこにも実体が無い。 */
  | "missing"
  /** dev サーバでしか解決しない `/src/...` を指している。 */
  | "source-path";

/** 解決しなかった資材の参照 1 件。 */
export type UnresolvedAsset = {
  /** リポジトリ相対のファイルパス。 */
  readonly file: string;
  /** そのファイルの中での行番号（1 始まり）。 */
  readonly line: number;
  /** 書かれていた URL。 */
  readonly url: string;
  /** 解決しない理由。 */
  readonly reason: AssetFailure;
};

/**
 * アプリの配信の根。
 *
 * @remarks
 * Next.js の規約で、カタログの設定から独立しています。カタログは `staticDirs` でここも並べて
 * 配信しますが、**アプリ側のコードが見られるのはここだけ**です。
 */
const APP_SERVED_ROOT = "public";

/**
 * 実体を確かめる拡張子。
 *
 * @remarks
 * ブラウザが URL を取りに行くものに限ります。取りに行かないものを含めると、props へ渡すだけの
 * 文字列を実在しない資材として報告します。
 */
const ASSET_EXTENSIONS = "svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|mp4|webm" as const;

/** 二重引用符で囲まれた、ルート絶対の資材 URL。 */
const ASSET_URL = new RegExp(String.raw`"(/[^"\s]*\.(?:${ASSET_EXTENSIONS}))"`, "g");

/**
 * 解決しないことが正しい参照。
 *
 * @remarks
 * 宣言を 1 箇所に集めるのは、**外した記録がどこにも残らない形にしないため**です。書き手の側へ
 * 無効化のマーカーを置く形にすると、story を写した先へマーカーも一緒に渡り、新しい違反が
 * 無言で許されます。
 *
 * ここが数件を超えるようなら、それは規則そのものが広すぎる合図です。逃がす先を増やすのではなく、
 * 何を資材と見るかを狭めてください。
 *
 * **`/src/...` はここへ書けません。** dev サーバでしか解決しない綴りは、どんな理由があっても
 * ビルドしたカタログで壊れます。
 *
 * - `avatar.stories.tsx` の `/存在しない画像.png` — 読み込みに失敗した姿を見せる story で、
 *   404 そのものが被写体である。実体を置くと story が成り立たない。撤去条件は、失敗を実体の
 *   無い URL 以外で作れるようになったとき
 * - `navigation-guard.stories.tsx` の `/manual.pdf` — `download` を指定した link が離脱の確認を
 *   要さないことを示す見本。押される前提が無く、実体は要らない。撤去条件は、この story が実物の
 *   配布物を指すようになったとき
 */
const INTENTIONALLY_UNRESOLVED: ReadonlySet<string> = new Set([
  "src/components/design-system/display/avatar/avatar.stories.tsx\t/存在しない画像.png",
  "src/components/app-starter/navigation-guard/navigation-guard.stories.tsx\t/manual.pdf",
]);

/**
 * カタログの設定から、配信の根をリポジトリ相対で取り出す。
 *
 * @remarks
 * 設定を import せずに読むのは、**読み込んだ時点で副作用が走る**ためです
 * （service worker の複製）。宣言をここへ写さないのは、写した側が古くなっても誰も落とさず、
 * 検査が黙って狭くなるからです。
 *
 * 読み取れなければ例外にします。根が分からないまま走らせると「違反なし」を報告します。
 *
 * @param source - `.storybook/main.ts` の中身
 */
export function parseStaticDirs(source: string): string[] {
  const declaration = /staticDirs:\s*\[([^\]]*)\]/.exec(source)?.[1];

  if (declaration === undefined) {
    throw new Error("`.storybook/main.ts` に `staticDirs` の宣言が見つかりません。");
  }

  const dirs = [...declaration.matchAll(/"([^"]+)"/g)].map((match) => groupAt(match, 1));

  if (dirs.length === 0) {
    throw new Error("`.storybook/main.ts` の `staticDirs` が空です。");
  }

  return dirs.map((dir) => posix.normalize(posix.join(".storybook", dir)));
}

/**
 * カタログしか見ないファイルか。
 *
 * @remarks
 * story と、カタログ自身の module が該当します。**それ以外は fixture も含めてアプリ側**として
 * 扱います。story だけが読む fixture であっても、カタログの資材を指す綴りを直書きすれば、
 * 同じ fixture をアプリが読んだ瞬間に 404 になるためです。カタログの資材が要るなら、
 * `~catalog/lib/sample-asset` が公開する名前を import します。
 *
 * @param file - リポジトリ相対のファイルパス
 */
export function isCatalogOnly(file: string): boolean {
  return file.startsWith(".storybook/") || /\.stories\.tsx?$/.test(file);
}

/**
 * ソースの中から、解決しない資材の URL を拾う。
 *
 * @remarks
 * **URL は文字列なので、指し先が無くても型検査も lint も build も落ちません。** カタログでは
 * 壊れた絵がそのまま描かれ、VRT はそれを基準画像として承認します。差分が出ないため、
 * 見直す機会も来ません。
 *
 * 組み立てた URL（テンプレートリテラル）は見ません。実行しなければ値が決まらないためです。
 *
 * @param file - リポジトリ相対のファイルパス
 * @param content - そのファイルの中身
 * @param root - 配信の根を解決する起点（リポジトリルート）
 * @param catalogRoots - カタログが配信する根（リポジトリ相対）
 */
export function findUnresolvedAssets(
  file: string,
  content: string,
  root: string,
  catalogRoots: readonly string[],
): UnresolvedAsset[] {
  const served = isCatalogOnly(file) ? catalogRoots : [APP_SERVED_ROOT];
  const unresolved: UnresolvedAsset[] = [];

  content.split("\n").forEach((text, index) => {
    for (const match of text.matchAll(ASSET_URL)) {
      const url = groupAt(match, 1);
      const line = index + 1;

      if (url.startsWith("/src/")) {
        unresolved.push({ file, line, url, reason: "source-path" });
        continue;
      }

      if (INTENTIONALLY_UNRESOLVED.has(`${file}\t${url}`)) continue;

      if (!served.some((dir) => existsSync(resolve(root, dir, `.${url}`)))) {
        unresolved.push({ file, line, url, reason: "missing" });
      }
    }
  });

  return unresolved;
}

const REASON_MESSAGE: Record<AssetFailure, string> = {
  missing: "配信の根に実体がありません",
  "source-path": "`/src/...` は dev サーバでしか解決しません。資材を配信の根へ置いてください",
};

/** 見つかったものを、そのまま直せる形の文言にする。 */
export function formatUnresolvedAssets(unresolved: readonly UnresolvedAsset[]): string {
  return unresolved
    .map(({ file, line, url, reason }) => `${file}:${line}: ${url} — ${REASON_MESSAGE[reason]}`)
    .join("\n");
}

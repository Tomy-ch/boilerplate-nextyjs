// cross browser で回す描画エンジンの宣言。撮る側（`playwright.e2e.config.ts` の projects）と、
// 何を見ていて何を見ていないかを書く側（`.github/workflows/e2e.yaml` / [README](../README.md)）が
// 読む唯一の宣言。

/**
 * ジャーニーを回す描画エンジン。
 *
 * @remarks
 * サポート対象は「Next.js の既定 browserslist を追認する（モダンブラウザ）」です
 * （[README](../README.md)「帯とエンジンは宣言から引く」）。モダンブラウザは実装としては
 * 3 つの描画エンジン（Blink / Gecko / WebKit）に畳まれ、Playwright の `chromium` /
 * `firefox` / `webkit` がそれぞれに対応します。**エンジンが同じブラウザは、ここで捕まえたい
 * 種類の差を持ちません** — Edge も Opera も Blink であり、iOS のブラウザは全て WebKit です。
 *
 * したがって**見ているのは 3 つだけ**で、ブラウザの銘柄も版も見ていません。版の下限は
 * テンプレートから作った側へ委ねられているため、ここで固定できる基準がありません。各エンジンの
 * 版は Playwright のコンテナイメージ（`docker-compose.dev-tools.yml` の digest）が決めます。
 *
 * 絞った事実を宣言として残すのは、job の名前が "Cross Browser" であるだけだと「全部見ている」と
 * 読まれるためです。
 */
export const ENGINES = ["chromium", "firefox", "webkit"] as const;

/** 回す描画エンジン。Playwright の project 名でもある。 */
export type Engine = (typeof ENGINES)[number];

/**
 * 画面の基準画像を撮るエンジン。
 *
 * @remarks
 * 1 つに絞るのは、**同じ画面をエンジンを変えて撮ると必ず差分になる**ためです。フォントの
 * ラスタライズも既定のフォームコントロールもエンジンごとに違うので、3 つぶんの基準画像は
 * 「3 通りの正しい絵」を持つことになり、退行と描画差の区別が付きません。story 単位の VRT が
 * 実行環境をイメージで固定しているのと同じ理由です。
 *
 * Blink を選ぶのは、基準画像を人が承認する面（GitHub 上で開く絵）と、開発中に画面を
 * 見る面が、いずれも既定でこのエンジンだからです。
 *
 * 他の 2 つで見るのは**見た目ではなく成立**です。ジャーニーが通ること、ブラウザが異常を
 * 報告しないことは 3 つとも見ます。
 */
export const SHOT_ENGINE: Engine = "chromium";

/** Playwright が既定で持つデスクトップのデバイス名。 */
export type DesktopDevice = "Desktop Chrome" | "Desktop Firefox" | "Desktop Safari";

/**
 * 描画エンジンに、Playwright が既定で持つデバイス名を対応させる。
 *
 * @remarks
 * 設定ファイルではなくここに置くのは、**取り違えても実行が緑のまま**だからです。project の名前は
 * エンジン名でも、渡すデバイスがそのエンジンでなければ、別のエンジンで回した結果が
 * `firefox` の名前で報告されます。cross browser で見たいものがそこで消えます。
 *
 * @param engine - 回す描画エンジン
 */
export function deviceFor(engine: Engine): DesktopDevice {
  if (engine === "firefox") return "Desktop Firefox";
  if (engine === "webkit") return "Desktop Safari";

  return "Desktop Chrome";
}

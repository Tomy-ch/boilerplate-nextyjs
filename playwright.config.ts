import { defineConfig } from "@playwright/test";

import { SHOT_THEMES, THEMES } from "./vrt/lib/themes";

/**
 * story 単位の visual regression の設定([0091](docs/adr/0091-test-verification-methods.md))。
 *
 * @remarks
 * 実行は必ず Playwright 公式イメージのコンテナ内で行います(`make vrt`)。フォントの
 * ラスタライズは OS と CPU アーキテクチャで変わるため、基準画像は「どの OS で撮ったか」
 * ではなく「どのイメージで撮ったか」で一意になります。ホスト直実行を許すと、撮った側の
 * 環境が基準になり、他の全員の手元と CI で全 story が差分になります。
 */

if (process.platform !== "linux") {
  throw new Error(
    "VRT はコンテナ内で実行してください(make vrt)。ホストで撮った基準画像は CI と一致しません。",
  );
}

export default defineConfig({
  testDir: "./vrt",
  testMatch: "**/*.spec.ts",
  // 生成物はすべて追跡対象外へ落とす。差分画像は基準画像と同じ拡張子で出るため、
  // 追跡下に置くと「更新済みの基準画像」と見分けが付かなくなる。
  outputDir: "tmp/vrt/results",
  // 系統 / テーマ / story の順に畳む。名前は spec が組み立てるため、ここは受け取るだけ。
  snapshotPathTemplate: "baseline/images/{arg}{ext}",
  fullyParallel: true,
  // 並列度は実行環境ではなく設定で決める。既定は論理コア数の半分で、走る場所によって変わる。
  workers: 4,
  // 1 件あたりの上限。撮影が収まるのを待つ猶予（下の expect）を内側に収める必要があり、
  // 既定の 30 秒だと待ち切る前に上限へ当たる。負荷が高いときに「揺らぎで落ちた」のか
  // 「順番待ちで落ちた」のか区別が付かなくなるため、外側を広く取る。
  timeout: 60_000,
  // 撮り直しで通る差分は無い。再試行は不安定な story を隠すだけで、隠れた分は基準画像の
  // 側へ蓄積する。
  retries: 0,
  // json は承認経路が読む。どの story がどれだけずれたかを機械可読で残しておかないと、
  // ラベルでの承認が「今落ちているもの全部」まで広がる。
  reporter: [
    ["list"],
    ["html", { outputFolder: "tmp/vrt/report", open: "never" }],
    ["json", { outputFile: "tmp/vrt/report.json" }],
  ],
  expect: {
    // 撮影は「同じ画面が 2 度続けて撮れる」まで待つ。既定の 5 秒では、描き終えるまでに
    // 間があるもの（mount 時に系列を描き足すグラフ、時間で閉じる通知）が収まりきらない。
    // 待つ時間を伸ばすのは差分を許すのとは別で、揺らぎが収まったことは同じ厳密さで見る。
    timeout: 20_000,
    toHaveScreenshot: {
      // 画素あたりの色差の許容。Playwright は YIQ 距離の上限を `35215 × threshold²` に取るため、
      // グレースケールでは `264 × threshold` までの差が 0 枚として数えられる。既定の `0.2` は
      // 上限 52.8 で、`neutral-400` と `neutral-500`（差 48）を取り違えても通ってしまう。
      //
      // `0.02` の上限は 5.28。並列実行時のラスタライズは、角の丸みのように弧を反字体で塗る箇所で
      // 実測 ±3 まで揺れる（測り方と値は `vrt/README.md`）。ここを 2.6 に切ると、その揺れが恒常的に
      // 赤として残り、撮り直しても次の実行で別の画素が同じ幅だけ動く。低コントラストの退行を
      // 捕まえる目的（差 48 を取り違えない）は 5.28 でも 9 倍の余裕がある。
      threshold: 0.02,
      // 枚数に許容は置かない。色差の側で下限を切ってあるので、残った差分は実在する。
      maxDiffPixels: 0,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  use: {
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    timezoneId: "Asia/Tokyo",
    locale: "ja-JP",
    contextOptions: {
      // Framer Motion の動きは CSS animation ではないため、撮影時の停止では止まらない
      // ([0051](docs/adr/0051-styling-system.md))。動きを求めない設定にして初期状態で撮る。
      reducedMotion: "reduce",
    },
  },
  // プロジェクト名がそのまま配色テーマであり、基準画像の置き場の一部になる。一覧の宣言は
  // [themes](vrt/lib/themes.ts)。
  //
  // 全 story を撮り axe を掛けるのは `SHOT_THEMES` のテーマだけ。もう片方は配色が `:root` へ
  // 届いているかだけを見る spec に絞る。両方で全 story を回すと実行が倍になり、テンプレートから
  // 作った側の CI がその分だけ課金される。
  projects: THEMES.map((name) => ({
    name,
    ...(SHOT_THEMES.some((shot) => shot === name) ? {} : { testMatch: "**/theme-tokens.spec.ts" }),
  })),
});

import { defineConfig } from "vitest/config";

import { EXCLUDED_FROM_CHECKS } from "./scripts/lib/untested-modules";

/**
 * 補助スクリプト(`scripts/**&#47;*.ts`)の suite。
 *
 * アプリ本体の suite ([vitest.config.ts](vitest.config.ts)) と分けるのは、検査する対象が
 * 違うから。`scripts/` に居るのは lint とゲートそのもので、壊れると「違反なし」を報告する
 * 向きに倒れる。落ちたときにアプリの退行と読み違えないよう、実行も CI のジョブも分ける。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      // アプリ本体の suite と出力先を分ける。pre-push は 2 つの suite を並列に走らせるため、
      // 既定の `coverage/` を共有すると `clean` が相手の `.tmp/` を消し、双方が
      // 「読もうとした中間ファイルが無い」で落ちる。CI はジョブが別なので衝突しない。
      reportsDirectory: "coverage-scripts",
      // 母数はディレクトリの列挙ではなく全 `.ts` に取る。ツールのディレクトリを足したとき
      // 黙って母数から漏れるのを避ける。外すのは除外宣言だけ。
      include: ["scripts/**/*.ts"],
      // `src/**` は本体側の設定が母数に持つ。ここで外すのは免除ではなく**境界**で、
      // `scripts/` の道具が `src/` の宣言を引くと、引かれた側がこちらの母数へ紛れ込む。
      // 二重に数えると、片方のしきい値がもう片方の被覆で決まる。
      exclude: [...EXCLUDED_FROM_CHECKS, "src/**"],
      reporter: ["text"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});

/**
 * 差分の構造から、この PR で回しておくべき検査を名指しする。
 *
 * @remarks
 * `a11y` / `e2e` / `lighthouse` は既定では PR で回らず、保護ブランチへの merge と日次が全数を
 * 持ちます（各ワークフローの冒頭）。ここが答えるのは**その待ち方で構わないか**で、答えは
 * ラベル 1 枚です。ゲートではありません。
 *
 * **挙げるのは、届く範囲が広いと構造から言い切れるものだけ。** 量で見る合図は
 * [`volume.ts`](volume.ts) が持ちます。ほとんどの PR で当たる規則を足すと、名指しが「常に 3 つ
 * 勧める」へ戻り、行数だけを見ていた頃と同じものになります。
 */

import { decideTrigger as decideE2eTrigger } from "../e2e/trigger";
import type { Change } from "../lib/numstat";
import { matchesPathRule, type PathRule } from "../lib/path-rule";
import { decideTrigger as decideLighthouseTrigger } from "../lighthouse/trigger";
import { movesResult } from "./subject";

/** 先送りにしている検査の、コメントに載る側。 */
export type CheckSummary = {
  /** 付けると回るラベル。 */
  readonly label: string;
  readonly runs: string;
  readonly duration: string;
};

/** 先送りにしている検査 1 つ。 */
type Check = CheckSummary & {
  /** 勧める理由。 */
  readonly rules: readonly PathRule[];
};

/**
 * 先送りにしている検査と、それを勧める理由。
 *
 * @remarks
 * ラベルの説明は [`.github/settings/labels.json`](../../.github/settings/labels.json) が持ち、
 * ここが持つのは**回るものと目安**です。同じ表を出す 2 つのコメントがこれを読みます。
 */
export const CHECKS: readonly Check[] = [
  {
    label: "run-a11y",
    runs: "全 story への axe",
    duration: "約 10 分",
    rules: [
      {
        globs: ["src/**/*.stories.tsx", ".storybook/**/*.stories.tsx"],
        reason: "story が動いています。axe が読むのは story が描いた実物です",
      },
      {
        globs: ["tokens/**/*.json"],
        reason:
          "配色の宣言が動いています。全ての story がこれを通り、contrast は実際に塗られた色でしか判定できません",
      },
      {
        globs: [".storybook/main.ts", ".storybook/preview.tsx", ".storybook/preview.css"],
        reason: "全ての story が通る器が動いています",
      },
    ],
  },
  {
    label: "run-e2e",
    runs: "主要ジャーニーと画面の比較",
    duration: "約 5 分",
    rules: [
      {
        globs: ["src/proxy.ts"],
        reason: "全てのリクエストが通る proxy が動いています",
      },
      {
        globs: ["next.config.ts", "src/config/security-headers/**/*.ts"],
        reason: "全ての応答に載る配信ヘッダが動いています。CSP の違反は実ブラウザでしか出ません",
      },
      {
        globs: ["e2e/journeys/**/*.spec.ts"],
        reason: "ジャーニーの宣言そのものが動いています",
      },
      {
        globs: ["mocks/**/*.ts"],
        reason: "mock の応答が動いています。CI ではこれがそのまま画面の中身になります",
      },
    ],
  },
  {
    label: "run-lighthouse",
    runs: "全画面の Core Web Vitals",
    duration: "約 16 分",
    rules: [
      {
        globs: ["src/app/fonts.ts"],
        reason: "全ての画面が同じ書体を読みます。書体の取得は LCP に直に効きます",
      },
      {
        globs: ["tokens/**/*.json"],
        reason: "寸法の宣言が動いています。CLS は配置が動いたときにしか出ません",
      },
      {
        globs: ["next.config.ts"],
        reason: "画像とバンドルの既定が動いています。全ての画面がこれを通ります",
      },
    ],
  },
] as const;

/** 名指しした検査 1 つ。 */
export type Recommendation = CheckSummary & {
  /** なぜ勧めるか。宣言の順に並ぶ。 */
  readonly reasons: readonly string[];
};

/**
 * まだラベルが付いておらず、この PR では回らない検査。
 *
 * @param labels - その PR が既に持つラベル。
 *
 * @remarks
 * 構造で名指しできなかったときに、行数だけを根拠として出す表の中身です。**既に付いているラベルは
 * 落とします** —— 回ることが決まった検査を「回すことを検討しろ」と並べても読む人の手は増えません。
 */
export function pending(labels: readonly string[]): CheckSummary[] {
  return CHECKS.filter((check) => !labels.includes(check.label)).map(
    ({ label, runs, duration }) => ({
      label,
      runs,
      duration,
    }),
  );
}

/**
 * 差分から、勧める検査を挙げる。
 *
 * @param changes - 変更されたファイルと、その変更行数。
 * @param labels - その PR が既に持つラベル。
 *
 * @remarks
 * 既に付いているラベルは挙げません。**検査ごとに落とします** —— 1 枚付いたことを理由に残る 2 つ
 * まで黙ると、付けた人が見なかった検査が名指しされないまま消えます。
 *
 * `lighthouse` と `e2e` は、それぞれの `trigger.ts` が構造を見て問答無用で回す差分では挙げません。
 * 既に回る PR へ「回すためのラベルを付けろ」と言うのは誤りです。
 */
export function recommend(changes: readonly Change[], labels: readonly string[]): Recommendation[] {
  const paths = changes.map((change) => change.path).filter(movesResult);
  const forced = new Set(
    [
      decideLighthouseTrigger(changes).kind === "force" ? "run-lighthouse" : undefined,
      decideE2eTrigger(changes).kind === "force" ? "run-e2e" : undefined,
    ].filter((label): label is string => label !== undefined),
  );

  return CHECKS.filter((check) => !labels.includes(check.label))
    .filter((check) => !forced.has(check.label))
    .map((check) => ({
      label: check.label,
      runs: check.runs,
      duration: check.duration,
      reasons: check.rules
        .filter((rule) => matchesPathRule(rule, paths))
        .map((rule) => rule.reason),
    }))
    .filter((recommendation) => recommendation.reasons.length > 0);
}

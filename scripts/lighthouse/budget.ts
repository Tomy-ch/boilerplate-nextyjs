import { parse } from "yaml";
import { z } from "zod";

/**
 * Core Web Vitals の予算の読み取りと判定。
 *
 * @remarks
 * 値そのものは [`performance-budget.yaml`](../../performance-budget.yaml) が持ちます。client
 * JavaScript の予算（[`../bundle-budget/budget.ts`](../bundle-budget/budget.ts)）と同じ置き場に
 * するのは、両方を 1 つの予算として扱っているためです。
 *
 * **上限は全画面へ一律に効きます。**画面ごとの宣言を必須にしないのは、既定値が Core Web Vitals
 * の "good" 境界そのもので、画面の用途によって動く値ではないためです。緩めたい画面だけが
 * `screens` に現れます。
 *
 * 根拠を必須項目にしてあるのは、宣言だけが増えて理由が残らない状態を作らないためです。空文字は
 * 読み込みの時点で落ちます。
 */

/** 判定する指標。 */
export const METRIC_KEYS = ["lcpMs", "clsScore", "tbtMs"] as const;

/** 判定する指標の名前。 */
export type MetricKey = (typeof METRIC_KEYS)[number];

export type MetricValues = Readonly<Record<MetricKey, number>>;

const limitSchema = z.object({
  limit: z.number().positive(),
  reason: z.string().trim().min(1),
});

const limitsSchema = z.object({
  lcpMs: limitSchema,
  clsScore: limitSchema,
  tbtMs: limitSchema,
});

const lighthouseSchema = z.object({
  runs: z.object({
    count: z.number().int().positive(),
    reason: z.string().trim().min(1),
  }),
  floor: z.object({
    screen: z.string().trim().min(1),
    reason: z.string().trim().min(1),
  }),
  metrics: limitsSchema,
  screens: z.record(z.string(), limitsSchema.partial()).default({}),
});

const fileSchema = z.object({ lighthouse: lighthouseSchema });

export type Budget = z.infer<typeof lighthouseSchema>;

/** 画面 1 つぶんの計測結果。 */
export type Measurement = {
  /** 画面の名前（`e2e/lib/screens.ts` の宣言と同じもの）。 */
  readonly name: string;
  /** 試行の中央値。 */
  readonly values: MetricValues;
  /** 何台目が測ったか。割らなかった実行では `undefined`。 */
  readonly shard?: number;
  /**
   * 機械の速さを読むためだけの測定か。
   *
   * @remarks
   * 床の画面は割った台すべてで測りますが、判定するのは担当の台のぶんだけです。台数ぶん判定
   * すると、1 台でも遅い実行があるだけで落ちます。
   */
  readonly control?: boolean;
};

/** 画面 1 つぶんの判定。 */
export type Verdict = Measurement & {
  /** その画面へ効いた上限。 */
  readonly limits: MetricValues;
  /** 上限を超えた量。超えていない指標は現れない。 */
  readonly over: Readonly<Partial<Record<MetricKey, number>>>;
};

/**
 * 宣言を読む。
 *
 * @param text - `performance-budget.yaml` の中身。
 * @throws 形が合わない場合と、根拠が空の場合。
 */
export function parseBudget(text: string): Budget {
  return fileSchema.parse(parse(text)).lighthouse;
}

/**
 * 画面へ効く上限を組み立てる。
 *
 * @remarks
 * 既定へ画面ごとの緩和を重ねます。宣言の無い画面は既定がそのまま効くため、画面を足しても
 * 予算の宣言を足す必要はありません。
 */
export function limitsFor(budget: Budget, name: string): MetricValues {
  const override = budget.screens[name] ?? {};

  return {
    lcpMs: (override.lcpMs ?? budget.metrics.lcpMs).limit,
    clsScore: (override.clsScore ?? budget.metrics.clsScore).limit,
    tbtMs: (override.tbtMs ?? budget.metrics.tbtMs).limit,
  };
}

/**
 * 計測を判定する。
 *
 * @param measurements - 画面ごとの中央値。
 * @param budget - 宣言。
 * @returns 計測と同じ順序の判定。
 */
export function judge(measurements: readonly Measurement[], budget: Budget): Verdict[] {
  return measurements
    .filter((measurement) => measurement.control !== true)
    .map((measurement) => {
      const limits = limitsFor(budget, measurement.name);
      const over: Partial<Record<MetricKey, number>> = {};

      for (const key of METRIC_KEYS) {
        if (measurement.values[key] > limits[key]) {
          over[key] = measurement.values[key] - limits[key];
        }
      }

      return { ...measurement, limits, over };
    });
}

/** 判定が 1 つでも超過しているか。 */
export function hasFailure(verdicts: readonly Verdict[]): boolean {
  return verdicts.some((verdict) => Object.keys(verdict.over).length > 0);
}

/**
 * 緩和が宣言されているのに計測されなかった画面。
 *
 * @remarks
 * 画面の名前が変わると、緩和はそのまま残るのに誰も照らされなくなります。緩和を持つ画面が
 * 消えたことは、予算に収まったことと見分けが付かないため、別に検出します。
 */
export function missingScreens(measurements: readonly Measurement[], budget: Budget): string[] {
  const measured = new Set(
    measurements.filter((m) => m.control !== true).map((measurement) => measurement.name),
  );

  return Object.keys(budget.screens).filter((name) => !measured.has(name));
}

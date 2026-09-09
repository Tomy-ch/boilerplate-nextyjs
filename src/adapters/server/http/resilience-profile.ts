/**
 * 接続先ごとの resilience 設定。
 *
 * @remarks
 * 接続先ごとに差し替えられるようにしているのは、劣化の許容度が接続先の性質で変わるためです。
 */
export type ResilienceProfile = {
  /** 1 回の試行に許す時間。これを超えた試行だけを中断し、再試行の余地は残す。 */
  perAttemptTimeoutMs: number;
  /** 再試行を含めた全体に許す時間。これを超えたら呼び出し全体を打ち切る。 */
  overallTimeoutMs: number;
  /** 最初の試行を含む試行回数の上限。 */
  maxAttempts: number;
  /** 通常リクエスト 1 件あたりに許す再試行の比率。 */
  retryBudgetRatio: number;
  /** 遮断器の設定。 */
  breaker: {
    /** 遮断に踏み切る失敗率。 */
    failureRate: number;
    /** 失敗率を判定するのに必要な観測数。 */
    sampleSize: number;
    /** 遮断を維持する時間。 */
    openMs: number;
    /** 復帰判定のために通す試行数。 */
    halfOpenProbes: number;
  };
};

/**
 * 既定の resilience 設定。
 *
 * @remarks
 * `maxAttempts` は 3 とします。全体時間の上限が per-attempt の 3 倍を少し超える値であり、
 * それ以上の試行は overall に阻まれて実行されないためです。
 */
export const DEFAULT_PROFILE: ResilienceProfile = {
  perAttemptTimeoutMs: 3_000,
  overallTimeoutMs: 10_000,
  maxAttempts: 3,
  retryBudgetRatio: 0.1,
  breaker: {
    failureRate: 0.5,
    sampleSize: 20,
    openMs: 5_000,
    halfOpenProbes: 3,
  },
};

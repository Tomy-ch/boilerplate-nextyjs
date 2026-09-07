/**
 * ホストの余力からローカルゲートの帯を決める。
 *
 * @remarks
 * 帯の意味と、使用率と作業ツリー数を使い分ける根拠は [README](../README.md) から辿る。
 */

/** ローカルゲートの帯。 */
type LoadBand = "full" | "low" | "ci-first";

/** 帯の解決結果。 */
export type BandResolution = {
  readonly band: LoadBand;
  /** 1 窓あたりに割り当てる CPU 数。1 を下回らない。 */
  readonly cpuShare: number;
  /** 帯を決めた根拠。出力へそのまま載せ、判定を黙らせない。 */
  readonly reason: string;
};

/** ここを超えたら飽和と見なす。CPU 1 つあたり実行待ちが 1 つ以上ある状態。 */
const SATURATED_UTILIZATION = 1;

/** ここを超えたら働いていると見なす。 */
const BUSY_UTILIZATION = 0.5;

/**
 * 実測の使用率と作業ツリーの数から帯を決める。
 *
 * @param worktrees 作業ツリーの数。1 未満は 1 として扱う。
 * @param cpus 論理 CPU 数。1 未満は 1 として扱う。
 * @param loadAverage 直近 1 分の load average。負値は 0 として扱う。
 */
export function resolveBand(input: {
  worktrees: number;
  cpus: number;
  loadAverage: number;
}): BandResolution {
  const worktrees = Math.max(1, Math.trunc(input.worktrees));
  const cpus = Math.max(1, Math.trunc(input.cpus));
  const loadAverage = Math.max(0, input.loadAverage);
  const cpuShare = Math.max(1, Math.floor(cpus / worktrees));
  const utilization = loadAverage / cpus;
  const measured = `使用率 ${utilization.toFixed(2)}（load ${loadAverage.toFixed(2)} / CPU ${cpus}）、作業ツリー ${worktrees} → 1 窓あたり ${cpuShare}`;

  if (utilization >= SATURATED_UTILIZATION) {
    return {
      band: "ci-first",
      cpuShare,
      reason: `${measured}。飽和しており、ここでの失敗は変更に起因すると信じられないため CI へ委ねます。`,
    };
  }

  if (utilization >= BUSY_UTILIZATION) {
    return {
      band: "low",
      cpuShare,
      reason: `${measured}。働いているため並列度を落として走らせます。`,
    };
  }

  return { band: "full", cpuShare, reason: `${measured}。余力があるため手元で全部走らせます。` };
}

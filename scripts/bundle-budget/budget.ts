import { parse } from "yaml";
import { z } from "zod";

/**
 * client 側の資材の予算の読み取りと判定。
 *
 * @remarks
 * 値そのものは [`performance-budget.yaml`](../../performance-budget.yaml) が持ちます。コードの外へ
 * 出してあるのは、具体値を用途依存としているためです。触るのは
 * 値だけで、判定を読む必要はありません。
 *
 * 根拠を必須項目にしてあるのは、宣言だけが増えて理由が残らない状態を作らないためです。空文字は
 * 読み込みの時点で落ちます。
 *
 * **増分は初期 JS・合計 JS・CSS へ別々に効きます。**
 */

const entrySchema = z.object({
  gzipKb: z.number().positive(),
  reason: z.string().trim().min(1),
});

const budgetSchema = z.object({
  routes: z.record(z.string(), entrySchema),
  growth: z.object({
    initialJs: entrySchema,
    totalJs: entrySchema,
    css: entrySchema,
  }),
});

export type Budget = z.infer<typeof budgetSchema>;

/** route 1 つぶんの計測結果。すべて gzip した byte。 */
export type Measurement = {
  /** 公開されている route。 */
  readonly route: string;
  /** 開いた時点で読む JS。 */
  readonly initialJs: number;
  /** そのうち、2 つ以上の route が読む chunk のぶん。 */
  readonly sharedJs: number;
  /** 遅延で読みうる JS。 */
  readonly deferredJs: number;
  /** 開いた時点で読む CSS。 */
  readonly css: number;
};

/** 量 1 つぶんの判定。 */
export type Quantity = {
  /** この PR の計測（byte）。 */
  readonly current: number;
  /** base での同じ計測。base に無い route なら `undefined`。 */
  readonly base: number | undefined;
  /** 増分の上限を超えた量（byte）。超えていなければ `undefined`。 */
  readonly overGrowth: number | undefined;
};

/** route 1 つぶんの判定。 */
export type Verdict = {
  /** 公開されている route。 */
  readonly route: string;
  /** 開いた時点で読む JS。上限が効くのはこの量。 */
  readonly initialJs: Quantity;
  /** そのうち、2 つ以上の route が読む chunk のぶん。判定は持たず、内訳として出す。 */
  readonly sharedJs: Quantity;
  /** 遅延で読みうる JS。判定は合計の側が持つ。 */
  readonly deferredJs: Quantity;
  /** 初期と遅延の和。 */
  readonly totalJs: Quantity;
  /** 開いた時点で読む CSS。 */
  readonly css: Quantity;
  /** 初期 JS の上限（byte）。宣言が無ければ `undefined`。 */
  readonly limit: number | undefined;
  /** 上限を超えた量（byte）。超えていなければ `undefined`。 */
  readonly overLimit: number | undefined;
};

const BYTES_PER_KB = 1024;

/**
 * 宣言を読む。
 *
 * @param text - `performance-budget.yaml` の中身。
 * @throws 形が合わない場合と、根拠が空の場合。
 */
export function parseBudget(text: string): Budget {
  return budgetSchema.parse(parse(text));
}

/**
 * 増分を判定に使うか、報告に留めるか。
 *
 * @remarks
 * 増分の上限は**変更 1 つぶんのラチェット**です（根拠は `performance-budget.yaml`）。base が
 * 配信中のブランチであるとき、そこへの差は個別に判定を通った変更の総和なので、変更 1 つぶんの
 * 幅を当てれば必ず割れます。その場では差を表に出すだけにし、判定は宣言した上限が持ちます。
 */
export type GrowthMode = "gate" | "report";

/**
 * 昇格の着地先。ここへ向いた PR は、変更 1 つではなくリリース 1 本を運ぶ。
 *
 * @remarks
 * 昇格の連なりの、受ける側だけを並べます。
 * `release/**` は受ける側でもあり出す側でもありますが、そこへ向く PR は変更 1 つなので入りません。
 */
const PROMOTION_TARGETS: ReadonlySet<string> = new Set(["production", "staging"]);

/**
 * base の名前から、増分の扱いを決める。
 *
 * @remarks
 * 判定を workflow の shell へ置かないのは、置くと検査が掛からないためです。ここに置けば
 * 「どの base で緩むのか」がテストで固定できます。
 *
 * @param baseRef - PR の base ブランチ名（`GITHUB_BASE_REF`）。PR でなければ `undefined`
 * @returns 昇格の PR なら報告だけ、それ以外は判定に使う
 */
export function growthModeFor(baseRef: string | undefined): GrowthMode {
  return baseRef !== undefined && PROMOTION_TARGETS.has(baseRef) ? "report" : "gate";
}

/** 1 つの量を、base と増分の上限に照らす。 */
function judgeQuantity(
  current: number,
  base: number | undefined,
  limit: number,
  mode: GrowthMode,
): Quantity {
  const growth = base === undefined ? 0 : current - base;
  const over = growth > limit ? growth - limit : undefined;

  return { current, base, overGrowth: mode === "gate" ? over : undefined };
}

/**
 * 計測を判定する。
 *
 * @remarks
 * 上限は宣言のある route にだけ効き、増分は全 route に効きます。base に無い route（この PR で
 * 増えた route）は増分を判定できないため、上限だけを見ます。
 *
 * @param current - この PR の計測。
 * @param base - base ブランチの計測。取れない場合は空で渡す。
 * @param budget - 宣言。
 * @param mode - 増分の扱い。既定は判定に使う。
 * @returns 計測と同じ順序の判定。
 */
export function judge(
  current: readonly Measurement[],
  base: readonly Measurement[],
  budget: Budget,
  mode: GrowthMode = "gate",
): Verdict[] {
  const baseByRoute = new Map(base.map((row) => [row.route, row]));
  const initialLimit = budget.growth.initialJs.gzipKb * BYTES_PER_KB;
  const totalLimit = budget.growth.totalJs.gzipKb * BYTES_PER_KB;
  const cssLimit = budget.growth.css.gzipKb * BYTES_PER_KB;

  return current.map((row) => {
    const declared = budget.routes[row.route];
    const limit = declared === undefined ? undefined : declared.gzipKb * BYTES_PER_KB;
    const previous = baseByRoute.get(row.route);
    const total = row.initialJs + row.deferredJs;
    const baseTotal = previous === undefined ? undefined : previous.initialJs + previous.deferredJs;

    return {
      route: row.route,
      initialJs: judgeQuantity(row.initialJs, previous?.initialJs, initialLimit, mode),
      // 内訳なので増分では落とさない。同じ増分が全 route へ並ぶのを避けるため、判定は
      // 初期 JS の側が 1 度だけ持つ。
      sharedJs: { current: row.sharedJs, base: previous?.sharedJs, overGrowth: undefined },
      deferredJs: { current: row.deferredJs, base: previous?.deferredJs, overGrowth: undefined },
      totalJs: judgeQuantity(total, baseTotal, totalLimit, mode),
      css: judgeQuantity(row.css, previous?.css, cssLimit, mode),
      limit,
      overLimit: limit !== undefined && row.initialJs > limit ? row.initialJs - limit : undefined,
    };
  });
}

/** 判定が 1 つでも超過しているか。 */
export function hasFailure(verdicts: readonly Verdict[]): boolean {
  return verdicts.some(
    (v) =>
      v.overLimit !== undefined ||
      v.initialJs.overGrowth !== undefined ||
      v.totalJs.overGrowth !== undefined ||
      v.css.overGrowth !== undefined,
  );
}

/**
 * 宣言されているのに計測されなかった route。
 *
 * @remarks
 * route の名前が変わると、宣言はそのまま残るのに誰も照らされなくなります。上限を持つ route が
 * 消えたことは、予算に収まったことと見分けが付かないため、別に検出します。
 */
export function missingRoutes(current: readonly Measurement[], budget: Budget): string[] {
  const measured = new Set(current.map((row) => row.route));

  return Object.keys(budget.routes).filter((route) => !measured.has(route));
}

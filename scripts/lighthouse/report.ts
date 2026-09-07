import { METRIC_KEYS, type Measurement, type MetricKey, type Verdict } from "./budget";

/**
 * 判定を PR コメントの本文へ畳む。
 *
 * @remarks
 * 落ちた人が最初に知りたいのは「どの画面の、どの指標が、どれだけ超えたか」です。指標ごとに列を
 * 分けるのは、performance スコア 1 つでは次に何を見ればよいかを答えられないためです。
 */

/** 指標の見出しと、値の書き方。 */
const METRIC_FORMAT: Readonly<Record<MetricKey, { label: string; format: (v: number) => string }>> =
  {
    lcpMs: { label: "LCP", format: (v) => `${(v / 1000).toFixed(2)} s` },
    clsScore: { label: "CLS", format: (v) => v.toFixed(3) },
    tbtMs: { label: "TBT", format: (v) => `${Math.round(v)} ms` },
  };

/** 1 つの指標を「値 / 上限」の形にする。超過していれば印を付ける。 */
function cell(verdict: Verdict, key: MetricKey): string {
  const { format } = METRIC_FORMAT[key];
  const measured = format(verdict.values[key]);
  const limit = format(verdict.limits[key]);
  const over = verdict.over[key];

  return over === undefined
    ? `${measured} / ${limit}`
    : `❌ ${measured} / ${limit}（+${format(over)}）`;
}

/**
 * 台ごとの床を 1 行にする。割らなかった実行では空になる。
 *
 * @remarks
 * **落ちた画面と同じ台の床が読めることが要点です。** TBT は runner の速さがそのまま乗数として
 * 効くため、その画面が遅いのか機械が遅いのかは床と見比べて判別します。割ると床は担当の台に
 * しか居ないので、担当でない台でも測って（判定はせず）ここへ並べます。
 *
 * @param measurements - 判定の対象を含む、その実行の全計測。
 * @param screen - 床の画面の名前。
 */
export function renderFloor(measurements: readonly Measurement[], screen: string): string {
  // 台の番号と値だけを取り出してから並べる。`shard` を持つものだけを通した配列にしておかないと、
  // 並べ替えが「番号を持たない場合」を書く羽目になり、決して通らない分岐が残る。
  const floors = measurements
    .flatMap((measurement) =>
      measurement.name === screen && measurement.shard !== undefined
        ? [{ shard: measurement.shard, tbtMs: measurement.values.tbtMs }]
        : [],
    )
    .toSorted((left, right) => left.shard - right.shard);

  if (floors.length < 2) {
    return "";
  }

  const cells = floors.map(
    (floor) => `${floor.shard} 台目 ${METRIC_FORMAT.tbtMs.format(floor.tbtMs)}`,
  );

  return `台ごとの床（\`${screen}\` の TBT）: ${cells.join(" / ")}`;
}

/**
 * 表を組み立てる。
 *
 * @param verdicts - 判定。
 * @param runs - 1 画面あたりの試行回数。中央値であることが読み取れるように添える。
 * @param floor - {@link renderFloor} が組んだ 1 行。空なら添えない。
 *
 * @remarks
 * 超過した画面を先に並べます。全画面を出すのは、超過していない画面の余裕がどれだけ残って
 * いるかが、次に重くする判断の材料になるためです。
 */
export function renderReport(verdicts: readonly Verdict[], runs: number, floor = ""): string {
  const failed = verdicts.filter((verdict) => Object.keys(verdict.over).length > 0);
  const passed = verdicts.filter((verdict) => Object.keys(verdict.over).length === 0);
  const rows = [...failed, ...passed];

  return [
    `${runs} 回ずつ計測した中央値と、その画面へ効いた上限。`,
    "",
    `| 画面 | ${METRIC_KEYS.map((key) => METRIC_FORMAT[key].label).join(" | ")} |`,
    `| --- | ${METRIC_KEYS.map(() => "---").join(" | ")} |`,
    ...rows.map(
      (verdict) =>
        `| \`${verdict.name}\` | ${METRIC_KEYS.map((key) => cell(verdict, key)).join(" | ")} |`,
    ),
    ...(floor === "" ? [] : ["", floor]),
  ].join("\n");
}

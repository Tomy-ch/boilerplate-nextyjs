// 複数の窓の所見を関心へ畳む判定。issue の作成と close は
// 入口([weekly/index.ts](weekly/index.ts))が持つ。
//
// **これはモデルの 2 つめの用途で、入力が既にモデルの出力である**（改善案の節）。順位付けと
// 測り直しは決定的な集計だけで済んでおり、畳み込みが落ちても週次は成立する
// （[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 2）。

import type { Observation } from "./observation.js";
import { BODY_SECTIONS, IMPROVEMENT_SECTION } from "./summarize.js";

/** 畳んだ先の issue に付けるラベル。 */
export const INTEGRATION_LABEL = "feedback-integration";

/** 畳んだ大元を閉じるときの理由。着地（完了）と区別する。 */
export const ROLLED_UP_REASON = "not planned";

/** 畳む対象になった 1 件。 */
export type RollupSource = {
  readonly number: number;
  readonly observation: Observation;
  readonly sections: Readonly<Record<string, string>>;
};

/** モデルが切り出した関心 1 つ。 */
export type Concern = {
  readonly title: string;
  readonly body: string;
  /** この関心の根拠になった issue の番号 */
  readonly sources: readonly number[];
};

const SOURCES_LINE = /^sources:(.*)$/;

/**
 * 畳む対象を選ぶ。
 *
 * @remarks
 * **改善案を持たない窓は畳みません。**畳み込みの目的は議題を作ることで、対応の当てが無い
 * 観測を束ねても議題にはなりません。それらは大元のまま残り、次に同じ鍵が増えたときに
 * 順位付けの側で浮きます。
 */
export function rollupTargets(sources: readonly RollupSource[]): readonly RollupSource[] {
  return sources.filter((source) => {
    const improvement = source.sections[IMPROVEMENT_SECTION];

    return improvement !== undefined && improvement !== "" && !improvement.startsWith("該当なし");
  });
}

/**
 * 関心への分解をモデルへ求める問いを組み立てる。
 *
 * @remarks
 * 分解の軸を**「窓」でも「ブランチ」でもなく関心**に置くことを明示します。窓で切ると、同じ
 * 問題が別の窓に現れたときに別々の課題として並び、**同じ議論を 2 回する**ことになります。
 */
export function buildConcernPrompt(targets: readonly RollupSource[]): string {
  const lines: string[] = [
    "以下は、開発セッションごとに記録された所見です。",
    "これらを**関心ごと**にまとめ直してください。",
    "",
    "まとめる軸は「どの窓で起きたか」ではなく「何が問題か」です。同じ問題が別の窓に",
    "現れているなら 1 つにまとめ、1 つの窓から別々の問題が出ているなら分けます。",
    "",
  ];

  for (const target of targets) {
    lines.push(`## 所見 #${target.number}`);

    for (const name of BODY_SECTIONS) {
      const text = target.sections[name];

      if (text === undefined || text === "" || text.startsWith("該当なし")) {
        continue;
      }

      lines.push(`### ${name}`, text);
    }

    lines.push("");
  }

  lines.push(
    "## 出力",
    "",
    "関心ごとに次の形で並べてください。関心の数は決めうちせず、材料から素直に切れる数にします。",
    "",
    "## <関心を一行で言い表した見出し>",
    "sources: <根拠にした所見の番号をカンマ区切りで>",
    "<その関心の説明と、取りうる対応。日本語で>",
    "",
    "書き方:",
    "- 見出しは対象（skill / rule / doc / ci / tool）が分かる言い方にする。",
    "- 材料から読み取れないことは書かない。1 件にしか根拠が無い関心も、それはそれで 1 つ。",
    "- 無理にまとめない。関係の無いものを 1 つにすると、どちらにも着手できなくなる。",
  );

  return lines.join("\n");
}

/**
 * モデルの出力を関心の一覧として読む。
 *
 * @remarks
 * `sources` を持たない見出しは捨てます。**根拠の無い関心は、後から「なぜこれが挙がったか」を
 * 辿れず、大元を閉じる根拠にもなりません。**既知の番号だけを残すのも同じ理由です。
 */
export function parseConcerns(output: string, known: readonly number[]): readonly Concern[] {
  const valid = new Set(known);
  const concerns: Concern[] = [];
  let title: string | undefined;
  let sources: number[] = [];
  let buffer: string[] = [];

  const flush = (): void => {
    const body = buffer.join("\n").trim();
    const kept = sources.filter((number) => valid.has(number));

    if (title !== undefined && kept.length > 0) {
      concerns.push({ title, body, sources: kept });
    }

    title = undefined;
    sources = [];
    buffer = [];
  };

  for (const raw of output.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^##(?!#)(.*)$/.exec(line)?.[1]?.trim();

    if (heading) {
      flush();
      title = heading;

      continue;
    }

    const matched = SOURCES_LINE.exec(line.trim());

    if (matched !== null && title !== undefined) {
      sources = (matched[1] ?? "")
        .split(",")
        .map((value) => Number(value.trim().replace(/^#/, "")))
        .filter((value) => Number.isInteger(value));

      continue;
    }

    if (title !== undefined) {
      buffer.push(line);
    }
  }

  flush();

  return concerns;
}

/**
 * 畳んだ先の issue の本文。
 *
 * @remarks
 * **根拠を必ず置きます。**畳んだ先は「読解の読解」で、大元より 1 段抽象が上がっているぶん、
 * どの観測から来たのかを辿れないと**検証できない主張**になります。
 */
export function renderIntegrationBody(concern: Concern): string {
  return [
    "<!-- 週次の統合が作成した。根拠は下の所見である -->",
    "",
    concern.body,
    "",
    "## 根拠",
    "",
    ...concern.sources.map((number) => `- #${number}`),
  ].join("\n");
}

/**
 * 畳んだ大元へ残すコメント。
 *
 * @remarks
 * 畳み先は 1 つとは限りません。**1 つの窓が別々の関心を同時に含むことは普通にあり**、そのとき
 * 複数の関心から根拠として参照されます。1 つだけ書くと、残りの関心へ辿れなくなります。
 */
export function renderRollupComment(integrationIssues: readonly number[]): string {
  const refs = integrationIssues.map((number) => `#${number}`).join(" ");

  return `週次の統合で ${refs} へ畳んだ。この所見はそちらで扱う。`;
}

/**
 * どの大元が、どの関心へ畳まれたかを引けるようにする。
 *
 * @remarks
 * 関心ごとに閉じると、複数の関心が同じ大元を指したとき 2 回目以降が「既に閉じている」に
 * なります。実害はありませんが、**コメントも 1 本ずつ増えて辿り先が散らばる**ので、大元を鍵に
 * 反転させてから 1 回だけ閉じます。
 */
export function rollupDestinations(
  created: readonly { readonly issue: number; readonly sources: readonly number[] }[],
): ReadonlyMap<number, readonly number[]> {
  const bySource = new Map<number, number[]>();

  for (const concern of created) {
    for (const source of concern.sources) {
      bySource.set(source, [...(bySource.get(source) ?? []), concern.issue]);
    }
  }

  return bySource;
}

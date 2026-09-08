// 読解を求める問いを組み立て、返ってきた本文を節ごとに読み分ける判定。
//
// **読解そのものはここでは行わない。**ここが持つのは「何を尋ねるか」と「返ってきたものを
// どう読み分けるか」だけで、モデルの呼び出しは入口が担う。
//
// 読解を CI ではなく手元で行うのは、[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 5 が
// 「読むのは記録を作った機械の上だけ」「外へ出るのは読んだ結果であって記録そのものではない」と
// 決めているためである。**逐語を public な場へ出す縮退経路は持たない。**

import { type Candidate, looksSecret } from "./candidates.js";
import type { Observation } from "./observation.js";

/**
 * 読解が埋める節。
 *
 * @remarks
 * 週次はこのうち `改善案` だけを名指しで拾います（[integration.ts](integration.ts)）。
 * 8 つのうち唯一、**そのまま議題になる形で書かれる節**だからです。
 */
export const BODY_SECTIONS: readonly string[] = [
  "結果",
  "摩擦",
  "AI の読み違い",
  "スキル / 規約の穴",
  "道具の穴",
  "人の介入",
  "改善案",
  "根拠",
];

/** 週次が名指しで拾う節。綴りを変えたときに、拾えなくなる側が黙って空になるのを防ぐ。 */
export const IMPROVEMENT_SECTION = "改善案";

/** ラベルの接頭辞。分類は `feedback/<種別>` の形で issue に付く。 */
export const KIND_LABEL_PREFIX = "feedback/";

/** 所見の種別。ラベルからの変換で許可リストとして使う。 */
export type FindingKind =
  | "skill"
  | "architecture"
  | "documentation"
  | "tooling"
  | "ai-misread"
  | "ci"
  | "developer-experience";

/** 取りうる種別の全体。 */
export const FINDING_KINDS: readonly FindingKind[] = [
  "skill",
  "architecture",
  "documentation",
  "tooling",
  "ai-misread",
  "ci",
  "developer-experience",
];

/** モデルが返した読解。 */
export type Summary = {
  readonly sections: Readonly<Record<string, string>>;
  readonly kinds: readonly FindingKind[];
  /** 出口の関門で落とした節の名前。落としたことは本文に出す */
  readonly dropped: readonly string[];
};

const KINDS_LINE = /^kinds:(.*)$/;

/**
 * 最終行から分類を取り出す。
 *
 * @remarks
 * `kinds:` の接頭辞が付かずに分類名だけを並べる出力が実際にありました。接頭辞だけを見ると、
 * **その行が本文に残ったまま分類が空になり**、issue が「分類なし」として集計されます。
 * だから**行の全体が既知の分類の並びなら、接頭辞が無くても分類として読みます** —— 本文の
 * 一部が偶然この形になることは、既知の名前だけで構成される必要があるためほぼ起きません。
 */
function kindsOf(lastLine: string): readonly FindingKind[] | null {
  const matched = KINDS_LINE.exec(lastLine);
  const body = matched === null ? lastLine : (matched[1] ?? "");
  const parts = body
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");

  if (matched === null && parts.length === 0) {
    return null;
  }

  const known = new Set<string>(FINDING_KINDS);

  if (matched === null && !parts.every((part) => known.has(part))) {
    return null;
  }

  const kinds: FindingKind[] = [];

  for (const part of parts) {
    if (known.has(part) && !kinds.includes(part as FindingKind)) {
      kinds.push(part as FindingKind);
    }
  }

  return kinds;
}

/**
 * 読解を求める問いを組み立てる。
 *
 * @remarks
 * **「読み取れないことは書かない」を最初に置きます。**埋めること自体が目的になると、根拠の
 * 無い所見が週次の数に入り、**スコアが観測ではなく作文を順位づけ始めます**。
 */
export function buildPrompt(observation: Observation, candidates: readonly Candidate[]): string {
  const lines: string[] = [
    "あなたは開発セッションの記録を読み、そこで何が摩擦になったかを言葉にする担当です。",
    "",
    "## 観測（決定的に数えた値）",
    "",
    `窓 ID: ${observation.windowId}`,
  ];

  if (observation.prompts !== undefined) {
    lines.push(`人の発話: ${observation.prompts}`);
  }

  if (observation.toolCalls !== undefined) {
    lines.push(`道具の呼び出し: ${observation.toolCalls}`);
  }

  if (observation.toolFailures !== undefined) {
    lines.push(`道具の失敗: ${observation.toolFailures}`);
  }

  if (observation.interrupts !== undefined) {
    lines.push(`中断: ${observation.interrupts}`);
  }

  for (const phase of observation.phases) {
    lines.push(`段 ${phase.from} → ${phase.to}: ${phase.sec} 秒`);
  }

  lines.push("", "## 読解候補（機械が選んだ逐語の抜粋）", "");

  if (candidates.length === 0) {
    lines.push("該当したターンはありません。");
  } else {
    for (const candidate of candidates) {
      lines.push(`- \`${candidate.reason}\``, `  > ${candidate.text}`);
    }
  }

  lines.push(
    "",
    "## 出力",
    "",
    "次の見出しをこの順で出力し、各節を日本語で埋めてください。見出し以外の前置きや後書きは書かないこと。",
    "",
    ...BODY_SECTIONS.map((section) => `## ${section}`),
    "",
    "書き方:",
    "- 読み取れないことは書かない。候補に根拠が無い節は「該当なし」とだけ書く。",
    "  埋めるために推測すると、この issue が後で集計されたとき根拠の無い所見が数に入る。",
    "- 根拠には、どの段・どの数・どの打刻に基づくかを書く。PR / コミット / issue の番号は参照してよい。",
    "  **セッションの記録の逐語を引用しないこと。**この issue は公開の場へ出るので、記録そのものは外へ出せない。",
    "  候補の内容は、逐語ではなく自分の言葉で言い直すこと。",
    "- 改善案は、対象（skill / rule / doc / ci / tool）が特定できる場合だけ書く。",
    "",
    "最後の行に、該当する分類をカンマ区切りで 1 行だけ出力してください。該当が無ければ空にすること。",
    `  kinds: ${FINDING_KINDS.join(" / ")} のうち該当するもの`,
  );

  return lines.join("\n");
}

/**
 * `## 見出し` で区切られた本文を、節ごとに読み分ける。
 *
 * @remarks
 * 知らない見出しは捨てます。ここが緩いと、**モデルが見出しを言い換えただけで本文が丸ごと
 * 欠けたことに気づけません**。
 */
export function parseSections(body: string): Readonly<Record<string, string>> {
  const known = new Set(BODY_SECTIONS);
  const sections: Record<string, string> = {};
  let current: string | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    if (current !== null) {
      const text = buffer.join("\n").trim();

      if (text !== "") {
        sections[current] = text;
      }
    }

    buffer = [];
  };

  for (const line of body.split("\n")) {
    const heading = /^##(?!#)(.*)$/.exec(line)?.[1]?.trim();

    if (heading) {
      flush();
      current = known.has(heading) ? heading : null;

      continue;
    }

    if (current !== null) {
      buffer.push(line);
    }
  }

  flush();

  return sections;
}

/**
 * モデルの出力を読み分ける。
 *
 * @remarks
 * 分類は最終行にだけ現れる約束なので、**末尾の非空行 1 本しか見ません**。行頭一致で全行を
 * 掃くと、根拠に引用した逐語がたまたま `kinds:` で始まっていた場合にその行が本文から抜かれます。
 *
 * 既知の節が 1 つも取れなければ `undefined` を返し、呼び出し側は**読解が無かったものとして
 * 扱います** —— 空の節を並べると「読んだが何も無かった」と区別が付きません。
 */
export function parseSummary(
  output: string,
  candidates: readonly Candidate[] = [],
): Summary | undefined {
  const lines = output.split("\n");
  const lastIndex = lines.map((line) => line.trim()).findLastIndex((line) => line !== "");
  const lastLine = lastIndex < 0 ? "" : (lines[lastIndex] ?? "").trim();
  const found = kindsOf(lastLine);
  const kinds = found ?? [];

  if (found !== null) {
    lines.splice(lastIndex, 1);
  }

  const { sections, dropped } = dropSecretSections(parseSections(lines.join("\n")), candidates);

  return Object.keys(sections).length === 0 ? undefined : { sections, kinds, dropped };
}

/**
 * 逐語とみなす一致の長さ。
 *
 * @remarks
 * 短すぎると、同じ話題を自分の言葉で言い直した文が当たります。長すぎると、言い回しを少し
 * 変えただけの引用が通ります。40 文字は**引用でなければ偶然一致しない長さ**として置いた
 * 初期値で、実運用の当たり方で動かす前提です。
 */
const QUOTE_RUN_CHARS = 40;

/** 空白を潰して比較の土俵を揃える。書式の違いを一致の差にしない。 */
function flatten(text: string): string {
  return text.replace(/\s+/g, "");
}

/**
 * 節が、渡した候補の逐語を含むか。
 *
 * @remarks
 * **これは宣言ではなく検査です。**候補として渡した本文は分かっているので、それが返ってきた
 * 本文にそのまま現れたかは機械で判定できます
 * （[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。
 *
 * 判定できるのは**渡した候補との一致だけ**です。モデルが候補以外の記憶から書いた逐語は
 * ここでは捕まりません —— 捕まる範囲を広げたければ、渡す材料の側を絞ります。
 */
export function containsQuote(text: string, candidates: readonly Candidate[]): boolean {
  const flat = flatten(text);

  if (flat.length < QUOTE_RUN_CHARS) {
    return false;
  }

  return candidates.some((candidate) => {
    const source = flatten(candidate.text);

    for (let i = 0; i + QUOTE_RUN_CHARS <= source.length; i += 1) {
      if (flat.includes(source.slice(i, i + QUOTE_RUN_CHARS))) {
        return true;
      }
    }

    return false;
  });
}

/**
 * 秘密らしき形を含む節を落とす。
 *
 * @remarks
 * 落とすのは節ごとで、**迷ったら落とします**。1 節欠けても他の節が残りますが、公開した 1 行は
 * 取り消せません。入口（候補の濾過）だけでなく出口もここで濾すのは、モデルが候補以外から
 * 書き起こす余地があるためです（[0110](../../docs/adr/0110-security-operations.md)）。
 *
 * 落とす理由は 2 つ —— 秘密らしき形と、**候補の逐語**です。後者は
 * [0160](../../docs/adr/0160-agent-environment-loop.md) 決定 5 の「記録そのものを外へ出さない」
 * に当たります。指示だけでは守られないことが実測で出たので、出口に検査を置いています。
 */
export function dropSecretSections(
  sections: Readonly<Record<string, string>>,
  candidates: readonly Candidate[] = [],
): {
  readonly sections: Record<string, string>;
  readonly dropped: readonly string[];
} {
  const kept: Record<string, string> = {};
  const dropped: string[] = [];

  for (const [name, text] of Object.entries(sections)) {
    if (looksSecret(text) || containsQuote(text, candidates)) {
      dropped.push(name);
    } else {
      kept[name] = text;
    }
  }

  return { sections: kept, dropped };
}

/**
 * 読解が無い窓を、理由で分ける。
 *
 * @remarks
 * 「読解が無い」には 3 つの理由があり、**同じものとして出すと嘘になります**。人が省いたのなら
 * 次も省かれます。モデルが呼べなかったのなら材料は手元にあり、次に呼べたときに読めます。
 * 材料そのものが無い（記録を取得できなかった）なら、読める見込みがありません。
 *
 * どれも「所見なし」ではありません（[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。
 */
export type ReadingGap = "読解済み" | "読解を省いた" | "モデルを呼べなかった" | "材料が無かった";

/**
 * 読解の状態を決める。
 *
 * @param skipped - 人が読解を省いたか
 */
export function readingGap(
  summary: Summary | undefined,
  hasMaterial: boolean,
  skipped = false,
): ReadingGap {
  if (summary !== undefined) {
    return "読解済み";
  }

  if (skipped) {
    return "読解を省いた";
  }

  return hasMaterial ? "モデルを呼べなかった" : "材料が無かった";
}

/** 分類を issue のラベル名にする。 */
export function kindLabels(kinds: readonly FindingKind[]): readonly string[] {
  return kinds.map((kind) => `${KIND_LABEL_PREFIX}${kind}`);
}

/**
 * issue に付けるラベル。
 *
 * @remarks
 * 分類のラベルは**読解できた窓にだけ**付きます。読めなかった窓に既定の分類を与えると、
 * 週次のクラスタが読んでいない窓で膨らみます —— そちらは `unclassified` として数えられる
 * のが正しい姿です。
 */
export function issueLabels(summary: Summary | undefined): readonly string[] {
  return summary === undefined ? ["feedback"] : ["feedback", ...kindLabels(summary.kinds)];
}

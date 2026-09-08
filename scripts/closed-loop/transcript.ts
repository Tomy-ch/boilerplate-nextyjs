// セッションの記録から、数えるだけで決まる事実を取り出す判定。ファイルの読み取りは
// 入口([index.ts](index.ts))が持ち、ここは受け取った行だけから答えを出す。
//
// なぜ記録を読むのか、どこまでを読んでよいのかは
// [0160](../../docs/adr/0160-agent-environment-loop.md) 決定 5 が持つ。**打刻が第一で、これは補完**
// である（[0161](../../docs/adr/0161-development-window-as-feedback-unit.md)）。
//
// ここが出すのは**数**だけで、解釈はしない。「何が難しかったか」は数からは出ない。

/** 記録から数えた事実。どれも解釈を含まない。 */
export type TranscriptCounts = {
  /** スキルの起動回数。名前ごと */
  readonly skills: Readonly<Record<string, number>>;
  /** 道具の使用回数。名前ごと */
  readonly tools: Readonly<Record<string, number>>;
  /** 道具が失敗を返した回数 */
  readonly toolErrors: number;
  /** 人が実行を中断した回数 */
  readonly interruptions: number;
  /** やり取りの数（記録の行のうち、人とモデルの発話） */
  readonly turns: number;
  /** 最初と最後の時刻（ISO 文字列）。窓との突き合わせに使う */
  readonly firstAt: string | null;
  readonly lastAt: string | null;
};

/**
 * スキルの起動を表す綴り。
 *
 * @remarks
 * 起動は 2 つの形で現れます —— `Skill` 道具の呼び出しと、`/<name>` を打ったときに記録へ入る
 * `<command-name>` です。**両方を数える**。片方だけにすると、打ち方の違いが起動回数の違いに化けます。
 */
const COMMAND_NAME_RE = /<command-name>\/?([a-z0-9-]+)<\/command-name>/g;

/**
 * スキルとして数えない綴り。
 *
 * @remarks
 * `/clear` `/compact` `/exit` はツール自身の組み込みで、このリポジトリのスキルではありません。
 * 混ぜると、**最も多く「起動された」のが自前のスキルではなくなり**、順位が意味を失います。
 */
const BUILTIN_COMMANDS = new Set(["clear", "compact", "exit", "help", "resume", "login", "logout"]);

/** 人が実行を中断したときに記録へ入る綴り。 */
const INTERRUPTION_MARK = "[Request interrupted";

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/**
 * 記録の 1 行（JSON）から数える。
 *
 * @remarks
 * 解釈できない行は**黙って飛ばします**。記録の形はツールが決めており、版が上がれば知らない形が
 * 現れます。そこで落ちると、**新しい形が 1 行混ざっただけで窓ごと数えられなくなります**。
 */
function countLine(entry: unknown, counts: MutableCounts): void {
  if (typeof entry !== "object" || entry === null) {
    return;
  }

  const record = entry as Record<string, unknown>;
  const type = record.type;

  if (type === "user" || type === "assistant") {
    counts.turns += 1;
  }

  const timestamp = typeof record.timestamp === "string" ? record.timestamp : null;

  if (timestamp !== null) {
    counts.firstAt = counts.firstAt === null || timestamp < counts.firstAt ? timestamp : counts.firstAt;
    counts.lastAt = counts.lastAt === null || timestamp > counts.lastAt ? timestamp : counts.lastAt;
  }

  const message = record.message;
  const content =
    typeof message === "object" && message !== null
      ? (message as Record<string, unknown>).content
      : undefined;

  if (typeof content === "string") {
    countText(content, counts);

    return;
  }

  if (!Array.isArray(content)) {
    return;
  }

  for (const block of content) {
    if (typeof block !== "object" || block === null) {
      continue;
    }

    const part = block as Record<string, unknown>;

    if (part.type === "tool_use" && typeof part.name === "string") {
      bump(counts.tools, part.name);

      if (part.name === "Skill") {
        const input = part.input;
        const skill =
          typeof input === "object" && input !== null
            ? (input as Record<string, unknown>).skill
            : undefined;

        if (typeof skill === "string") {
          bump(counts.skills, skill);
        }
      }
    }

    if (part.type === "tool_result" && part.is_error === true) {
      counts.toolErrors += 1;
    }

    if (typeof part.text === "string") {
      countText(part.text, counts);
    }
  }
}

function countText(text: string, counts: MutableCounts): void {
  if (text.includes(INTERRUPTION_MARK)) {
    counts.interruptions += 1;
  }

  for (const match of text.matchAll(COMMAND_NAME_RE)) {
    const name = match[1];

    if (name !== undefined && !BUILTIN_COMMANDS.has(name)) {
      bump(counts.skills, name);
    }
  }
}

type MutableCounts = {
  skills: Record<string, number>;
  tools: Record<string, number>;
  toolErrors: number;
  interruptions: number;
  turns: number;
  firstAt: string | null;
  lastAt: string | null;
};

/**
 * 記録の行を数える。
 *
 * @param lines - 1 行 1 JSON の記録。解釈できない行は飛ばす
 */
export function countTranscript(lines: readonly string[]): TranscriptCounts {
  const counts: MutableCounts = {
    skills: {},
    tools: {},
    toolErrors: 0,
    interruptions: 0,
    turns: 0,
    firstAt: null,
    lastAt: null,
  };

  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }

    try {
      countLine(JSON.parse(line), counts);
    } catch {
      // 壊れた行は飛ばす。数えられなかった量は `countUnparsable` が持つ。
      continue;
    }
  }

  return counts;
}

/**
 * 解釈できなかった行の数。
 *
 * @remarks
 * **飛ばした行を黙って落とさない。**記録の形が変わったのか、書き込みの途中だったのかは
 * ここでは決まりませんが、**数えられなかった量は報告に出す**必要があります
 * （[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。
 */
export function countUnparsable(lines: readonly string[]): number {
  return lines.filter((line) => {
    if (line.trim() === "") {
      return false;
    }

    try {
      JSON.parse(line);

      return false;
    } catch {
      return true;
    }
  }).length;
}

/**
 * 宣言されたスキルのうち、記録に 1 度も現れなかったもの。
 *
 * @remarks
 * **これは退役の根拠ではない**（[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 3）。
 * 機会を待つスキルは、機会が来なかった期間について何も語りません。判定は利用の型に対して行い、
 * ここが返すのは**その判定の入力**です。
 */
export function neverInvoked(
  declared: readonly string[],
  counts: TranscriptCounts,
): readonly string[] {
  return declared.filter((name) => (counts.skills[name] ?? 0) === 0);
}

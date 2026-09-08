// セッションの記録の 1 行から、出来事を取り出す判定。ファイルの読み取りは入口が持ち、
// ここは受け取った行だけから答えを出す。
//
// 数え上げ([transcript.ts](transcript.ts))も、読ませる候補の選定([candidates.ts](candidates.ts))も、
// ここが出した出来事の列を読む。**記録の形を知っているのはこのモジュールだけ**にするためで、
// 形が変わったときに直す場所を 1 つにする。
//
// なぜ記録を読むのか、どこまでを読んでよいのかは
// [0160](../../docs/adr/0160-agent-environment-loop.md) 決定 5 が持つ。

/** 出来事の種類。 */
type EventKind = "prompt" | "assistant" | "tool_use" | "tool_result" | "interrupt" | "command";

/** 記録から取り出した出来事 1 つ。 */
export type Event = {
  /** 起きた時刻（epoch 秒）。記録に時刻が無ければ 0 */
  readonly at: number;
  readonly kind: EventKind;
  /** `prompt` / `interrupt` の本文 */
  readonly text?: string;
  /** `tool_use` の道具名、`command` のスキル名 */
  readonly name?: string;
  /** `tool_result` が成功したか */
  readonly ok?: boolean;
};

/**
 * 記録の形のうち、この判定が読む部分だけ。
 *
 * @remarks
 * 全体を型にしません —— 形を決めているのはツールで、版が上がれば知らない鍵が増えます。
 * **読む鍵だけを宣言する**ことで、増えた鍵はここを素通りします。
 */
type Line = { readonly type?: unknown; readonly timestamp?: unknown; readonly message?: unknown };
type Message = { readonly content?: unknown };
type SkillInput = { readonly skill?: unknown };
type Block = {
  readonly type?: unknown;
  readonly name?: unknown;
  readonly input?: unknown;
  readonly is_error?: unknown;
  readonly text?: unknown;
};

/**
 * `/<名前>` を打ったときに記録へ入る綴り。
 *
 * @remarks
 * 起動は 2 つの形で現れます —— `Skill` 道具の呼び出しと、この綴りです。**両方を出す**。
 * 片方だけにすると、打ち方の違いが起動回数の違いに化けます。
 */
const COMMAND_TAG_OPEN = "<command-name>";
const COMMAND_TAG_CLOSE = "</command-name>";
const COMMAND_NAME_RE = /<command-name>\/?[a-z0-9-]+<\/command-name>/g;

/** 人が実行を中断したときに記録へ入る綴り。 */
const INTERRUPTION_MARK = "[Request interrupted";

/** ISO の時刻を epoch 秒にする。読めなければ 0。 */
function toEpoch(value: unknown): number {
  if (typeof value !== "string") {
    return 0;
  }

  const ms = Date.parse(value);

  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

/** 発話の中身 1 つ分から出来事を取り出す。 */
function fromBlock(part: Block, at: number): readonly Event[] {
  const found: Event[] = [];

  if (part.type === "tool_use" && typeof part.name === "string") {
    found.push({ at, kind: "tool_use", name: part.name });

    if (part.name === "Skill") {
      const input = part.input;
      const skill =
        typeof input === "object" && input !== null ? (input as SkillInput).skill : undefined;

      if (typeof skill === "string") {
        found.push({ at, kind: "command", name: skill });
      }
    }
  }

  if (part.type === "tool_result") {
    found.push({ at, kind: "tool_result", ok: part.is_error !== true });
  }

  if (typeof part.text === "string") {
    found.push(...fromText(part.text, at));
  }

  return found;
}

/** 本文から、中断と `/<名前>` の起動を取り出す。 */
function fromText(text: string, at: number): readonly Event[] {
  const found: Event[] = [];

  if (text.includes(INTERRUPTION_MARK)) {
    found.push({ at, kind: "interrupt", text });
  }

  for (const [tag] of text.matchAll(COMMAND_NAME_RE)) {
    const name = tag.slice(COMMAND_TAG_OPEN.length, -COMMAND_TAG_CLOSE.length).replace(/^\//, "");

    found.push({ at, kind: "command", name });
  }

  return found;
}

/**
 * 記録の 1 行から出来事を取り出す。
 *
 * @remarks
 * 解釈できない行は**空を返します**。記録の形はツールが決めており、版が上がれば知らない形が
 * 現れます。そこで落ちると、**新しい形が 1 行混ざっただけで窓ごと読めなくなります**。
 * 落とした量は `countUnparsable` が別に数えるので、黙って消えるわけではありません。
 */
export function parseLine(line: string): readonly Event[] {
  if (line.trim() === "") {
    return [];
  }

  let entry: unknown;

  try {
    entry = JSON.parse(line);
  } catch {
    return [];
  }

  if (typeof entry !== "object" || entry === null) {
    return [];
  }

  const record = entry as Line;
  const at = toEpoch(record.timestamp);
  const found: Event[] = [];

  if (record.type === "user") {
    found.push({ at, kind: "prompt", text: textOf(record) });
  }

  if (record.type === "assistant") {
    found.push({ at, kind: "assistant" });
  }

  const message = record.message;
  const content =
    typeof message === "object" && message !== null ? (message as Message).content : undefined;

  if (typeof content === "string") {
    found.push(...fromText(content, at));

    return found;
  }

  if (!Array.isArray(content)) {
    return found;
  }

  for (const block of content) {
    if (typeof block !== "object" || block === null) {
      continue;
    }

    found.push(...fromBlock(block as Block, at));
  }

  return found;
}

/** 人の発話の本文。文字列でも、text ブロックの連なりでも拾う。 */
function textOf(record: Line): string {
  const message = record.message;
  const content =
    typeof message === "object" && message !== null ? (message as Message).content : undefined;

  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .flatMap((block) =>
      typeof block === "object" && block !== null && typeof (block as Block).text === "string"
        ? [(block as Block).text as string]
        : [],
    )
    .join("\n");
}

/** 記録の全行から出来事を取り出す。 */
export function parseTranscript(lines: readonly string[]): readonly Event[] {
  return lines.flatMap(parseLine);
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
 * 窓の時間帯に入る出来事だけを取り出す。
 *
 * @remarks
 * **時刻を持たない出来事は入れません。**どの窓のものか決められないものを既定でどこかへ
 * 入れると、その窓の数だけが理由なく増えます。
 *
 * 閉じていない窓は終端を持たないので、開いた後のすべてが入ります。集計の対象は閉じた窓
 * だけなので、この形が問題になるのは診断のときだけです。
 */
export function withinWindow(
  events: readonly Event[],
  openedAt: number,
  closedAt: number | null,
): readonly Event[] {
  return events.filter(
    (event) => event.at > 0 && event.at >= openedAt && (closedAt === null || event.at <= closedAt),
  );
}

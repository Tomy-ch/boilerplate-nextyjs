/**
 * `mise.toml` の `[tools]` が固定する版と、pin に添えた冷却の免除の読み取り。
 *
 * @remarks
 * 読み手は 2 つあります。冷却の検査（`scripts/tools-cooldown`）は pin と免除の両方を、抑止の棚卸し
 * （`scripts/suppression-expiry`）は免除だけを読みます。同じファイルを 2 通りに読むと、片方だけが
 * 直った状態が黙って生まれるため、読み方はここ 1 箇所が持ちます。
 *
 * 値の読み取りはパーサに任せ、位置とコメントは生の行から取ります。コメントは構文木に残らない
 * ので、パーサだけでは免除を読めません。**両方で数えた pin の件数が食い違えば落とします** ——
 * 生の行の読み方が壊れたまま 0 件へ縮退すると、免除の無い pin として通ります。
 */

import { parse as parseToml } from "smol-toml";

/** 宣言ファイルの位置（リポジトリルート相対）。 */
export const MISE_FILE = "mise.toml";

/**
 * 冷却の免除を宣言するコメントの書き出し。
 *
 * @remarks
 * pin の直上のコメント塊に置きます。この行から塊の末尾までが免除の理由と撤回条件で、塊の中で
 * これより上の行は pin の説明として読みません。撤回条件は窓が明ける日を `YYYY-MM-DD` で含める
 * こと —— 免除が要るのは窓の内側に居るあいだだけで、明けた日が撤回の日です。
 */
export const IGNORE_DIRECTIVE = "tools-cooldown-ignore:";

/** pin に添えられた冷却の免除。 */
type CooldownIgnore = {
  /** 理由と撤回条件の散文。 */
  readonly condition: string;
  /** 免除の宣言が始まる行（1 始まり）。 */
  readonly line: number;
};

/** `[tools]` の pin 1 件。 */
export type MisePin = {
  /** backend 付きのキー（`aqua:owner/repo` など）。 */
  readonly key: string;
  /** 固定している版。書かれたまま。 */
  readonly version: string;
  /** pin の行（1 始まり）。 */
  readonly line: number;
  /** 添えられた免除。無ければ null。 */
  readonly ignore: CooldownIgnore | null;
};

/** `key = value` の行からキーを取る。引用の有無を問わない。 */
const ASSIGNMENT = /^\s*(?:"([^"]+)"|([^\s=#"]+))\s*=/;
/** テーブルの見出し。名前の前後の空白と行末のコメントは読み飛ばす。 */
const TABLE_HEADER = /^\s*\[\s*([^\]\s]+)\s*\]\s*(?:#.*)?$/;

/** pin を `<key>@<version>` の 1 語にする。免除の対象名と差分の同定に使う。 */
export function pinId(pin: Pick<MisePin, "key" | "version">): string {
  return `${pin.key}@${pin.version}`;
}

/** コメント行 1 つ。`#` と直後の空白を落とした本文を持つ。 */
type CommentLine = { readonly text: string; readonly line: number };

/**
 * `[tools]` の pin を読む。
 *
 * @param text - `mise.toml` の中身
 * @returns 書かれた順の pin
 * @throws `[tools]` が無いとき、版が文字列でないとき、生の行の代入をパーサの結果と突き合わせ
 * られないとき、生の行から見つけた pin の件数がパーサの件数と食い違うとき
 */
export function readPins(text: string): readonly MisePin[] {
  const versions = versionsByParser(text);
  const pins = pinsByLine(text, versions);

  if (pins.length !== versions.size) {
    throw new Error(
      `pin の件数が食い違います（パーサ ${versions.size} 件 / 生の行 ${pins.length} 件）`,
    );
  }

  return pins;
}

/**
 * パーサが `[tools]` に読んだ、キーごとの版。
 *
 * @throws `[tools]` が無いとき、版が文字列でないとき
 */
function versionsByParser(text: string): ReadonlyMap<string, string> {
  const tools = parseToml(text)["tools"];

  if (typeof tools !== "object" || tools === null || Array.isArray(tools)) {
    throw new Error("[tools] テーブルがありません");
  }

  const versions = new Map<string, string>();

  for (const [key, value] of Object.entries(tools)) {
    if (typeof value !== "string") {
      throw new TypeError(`${key} の版が文字列ではありません（テーブル形式の宣言は読めません）`);
    }

    versions.set(key, value);
  }

  return versions;
}

/**
 * 生の行から読んだ `[tools]` の pin。位置と直上のコメント塊はここで取り、版はパーサの結果から引く。
 *
 * @throws 生の行の代入をパーサの結果と突き合わせられないとき
 */
function pinsByLine(text: string, versions: ReadonlyMap<string, string>): MisePin[] {
  const pins: MisePin[] = [];
  // 直前から続いているコメント塊。コメントでない行で切れる。
  let comments: CommentLine[] = [];
  let inTools = false;

  for (const [index, raw] of text.split("\n").entries()) {
    const line = index + 1;
    const trimmed = raw.trim();

    if (trimmed.startsWith("#")) {
      comments.push({ text: trimmed.replace(/^#\s?/, ""), line });
      continue;
    }

    const block = comments;
    comments = [];

    const header = TABLE_HEADER.exec(raw);

    if (header !== null) {
      inTools = header[1] === "tools";
      continue;
    }

    if (!inTools) continue;

    const key = assignedKeyIn(raw);

    if (key === undefined) continue;

    const version = versions.get(key);

    if (version === undefined) {
      throw new Error(`${line} 行目の ${key} をパーサの結果と突き合わせられません`);
    }

    pins.push({ key, version, line, ignore: ignoreIn(block) });
  }

  return pins;
}

/** その行が代入しているキー。代入の行でなければ undefined。 */
function assignedKeyIn(raw: string): string | undefined {
  const assignment = ASSIGNMENT.exec(raw);

  return assignment?.[1] ?? assignment?.[2];
}

/** pin の直上のコメント塊から免除を読む。宣言が無ければ null。 */
function ignoreIn(block: readonly CommentLine[]): CooldownIgnore | null {
  const start = block.find(({ text }) => text.startsWith(IGNORE_DIRECTIVE));

  if (start === undefined) return null;

  const condition = block
    .slice(block.indexOf(start))
    .map(({ text }, offset) => (offset === 0 ? text.slice(IGNORE_DIRECTIVE.length) : text))
    .map((text) => text.trim())
    .filter((text) => text !== "")
    .join(" ");

  return { condition, line: start.line };
}

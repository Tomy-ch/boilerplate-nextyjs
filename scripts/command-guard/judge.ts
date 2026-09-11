// 塞いだコマンドが、宣言の前方一致では届かない位置に現れていないかを判定する。
//
// **塞ぐ対象を自分で持たない。**`.claude/settings.json` の `permissions.deny` から導出する。宣言を
// 2 か所に置くと、片方だけを直した日に「deny にあるのに通る」が生まれる。
//
// 前方一致が届かないのは 3 つで、いずれもここが埋める。
//
// - **位置** —— `Bash(make tag-patch *)` は `pnpm build && make tag-patch` に当たらない
// - **引数なし** —— 同じ宣言は素の `make tag-patch` にも当たらない。しかも危険な target ほど
//   引数なしが通常の呼び方である
// - **包み** —— `bash -c` / `rtk run` / `make ai-` は中身を実行するので、包みを剥がして判定する

/**
 * 区切りの直後はコマンド位置になる。単体の `(` だけは散文に多すぎるので採らない。
 *
 * @remarks
 * 単独の `&` も区切りである（`cmd1 & cmd2` は cmd1 を背後へ回して cmd2 を続ける）。`&&` と
 * 二重に当たらないよう前後を見る。backtick とプロセス置換 `<(` / `>(` も、`$(` と同じく
 * **直後がコマンド位置**になる —— `$(` だけを塞ぐと同じ概念の別綴りが素通りする。
 */
const SEPARATOR = /(?:\|\||&&|(?<!&)&(?!&)|[;|\n`]|\$\(|[<>]\()/g;

/** 束ねられた短 flag（`-rf`）。長 flag と、`-` 単体は含まない。 */
const SHORT_FLAG = /^-[^-\s]+$/;

/** heredoc の本体。散文をコマンド行で書くので、ここを見ると文書の中身で誤爆する。 */
const HEREDOC_BODY = /<<-?\s*(["']?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\2$/gm;

/** 中身をそのまま実行する包みと、剥がしたあとに残す綴り。 */
const WRAPPERS: readonly (readonly [RegExp, string])[] = [
  // quiet.mk の `ai-%` は `make <target>` を回す入口なので、target 名だけを残す。
  [/^make\s+ai-/, "make "],
  [/^rtk\s+(?:run|summary|smart)\s+/, ""],
  [/^(?:nohup|time)\s+/, ""],
  [/^env\s+(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, ""],
];

/** `sh -c <引用>` は引用の中身がそのままコマンド行なので、引用を落とす前に剥がす。 */
const SHELL_C = /^(?:(?:ba)?sh|eval)\s+(?:-c\s+)?(["'])([\s\S]*?)\1/;

/** 宣言とコマンド行を、同じ形（先頭の語 + 求める flag）へ割った結果。 */
export type CommandShape = {
  /** flag が現れる前までの語。`git switch -f` なら `git switch`。 */
  readonly head: string;
  /** 束ねを解いた短 flag の文字。`-rf` と `-r -f` と `-rvf` が同じ集合になる。 */
  readonly shortFlags: ReadonlySet<string>;
  /** 長 flag。綴りが意味を持つので、集合へ崩さず前方一致で照合する。 */
  readonly longFlags: readonly string[];
};

/**
 * `permissions.deny` の宣言の一覧を、設定の中身から取り出す。
 *
 * @remarks
 * **ここが返す配列が、塞ぐ対象の母集合そのものです。** キーの綴りを 1 文字間違えても型検査は
 * `unknown` 経由で通り、例外も出ず、黙って空が返ります —— そうなると `judge` がどれだけ正しくても
 * 何も塞ぎません。入口へ置くと検査の母数から外れるので、判定はここに置きます
 * （[README](../README.md)）。
 *
 * @param settings - `.claude/settings.json` を読んだもの
 */
export function extractDenyEntries(settings: unknown): readonly string[] {
  const entries = (settings as { permissions?: { deny?: unknown } })?.permissions?.deny;
  if (!Array.isArray(entries)) return [];

  return entries.filter((entry): entry is string => typeof entry === "string");
}

/**
 * PreToolUse のペイロードから、これから走るコマンド行を取り出す。
 *
 * @remarks
 * **取り出せなければ空を返し、呼び出し側が通します。** ペイロードの形が変わったときに止めると、
 * あらゆる Bash が止まります。ただし空を返すことは「塞ぐ対象が無い」ではなく「分からない」なので、
 * ここが黙って空を返し続ける壊れ方を検査で殺しておきます。
 *
 * @param raw - フックが標準入力へ渡してきた JSON
 */
export function readCommandLine(raw: string): string {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return "";
  }

  const command = (payload as { tool_input?: { command?: unknown } })?.tool_input?.command;
  return typeof command === "string" ? command : "";
}

/** 1 つの deny 宣言から取り出した、照合に要るものすべて。 */
export type Literal = {
  /** 宣言の綴り。報告にそのまま出る。 */
  readonly source: string;
  /** コマンド位置で前方一致させる先頭部分。 */
  readonly head: string;
  /**
   * 先頭部分の後ろに、この順で現れることを求める断片。
   *
   * @remarks
   * `Bash(gh api *DELETE*)` のように `*` が途中にもある宣言は、**先頭だけを見ると `gh api` を
   * まるごと塞ぎます**。`allow` が `Bash(gh api *)` を許している以上それは誤拒否で、誤爆した拒否は
   * 迂回の動機になります。断片を全部求めることで、宣言が塞ぐつもりだったものだけが当たります。
   */
  readonly fragments: readonly string[];
  /**
   * 直後に区切りを求めず、そのまま前方一致させるか。
   *
   * @remarks
   * `Bash(git switch release/*)` の `*` は語の途中に立つので、綴りは `git switch release/` で
   * 終わり、**直後には必ず語の続きが来ます**。ここで区切りを求めると `git switch release/v1.0.0` が
   * 一度も当たりません。`Bash(make tag-patch *)` のように `*` の前が空白のものは、逆に区切りを
   * 求めないと `make tag-patch-dry` まで巻き込みます。
   */
  readonly openEnded: boolean;
};

/**
 * `permissions.deny` の宣言から、コマンド位置で照合するものを取り出す。
 *
 * @remarks
 * `Bash(...)` 以外（`Edit(...)` など）は Bash の判定に関係しないので落とします。
 */
export function deriveLiterals(denyEntries: readonly string[]): readonly Literal[] {
  const PREFIX = "Bash(";
  const seen = new Map<string, Literal>();

  for (const entry of denyEntries) {
    // 綴りを取るのに添字を使わない。`matched[1] ?? ""` の右側は到達しない分岐で、
    // 「起きないこと」を検査で示せないまま母数に残る。
    if (!entry.startsWith(PREFIX) || !entry.endsWith(")")) continue;

    const body = entry.slice(PREFIX.length, -1);
    const starAt = body.indexOf("*");
    const beforeStar = starAt < 0 ? body : body.slice(0, starAt);
    const head = beforeStar.trim();
    if (!head) continue;

    const fragments =
      starAt < 0
        ? []
        : body
            .slice(starAt + 1)
            .split("*")
            .map((fragment) => fragment.trim())
            .filter(Boolean);

    seen.set(`${head}\u0000${fragments.join("\u0000")}`, {
      source: head,
      head,
      fragments,
      openEnded: !/\s$/.test(beforeStar),
    });
  }

  return [...seen.values()].sort((a, b) => a.head.localeCompare(b.head));
}

/**
 * コマンド行を「先頭の語」と「flag」へ割る。
 *
 * @remarks
 * flag を綴りのまま照合すると、順番と束ね方の数だけ宣言が要ります（`rm -rf` と `rm -fr` を別々に
 * 書く形）。短 flag を文字の集合として見れば 1 つの宣言で済みますが、**大文字小文字は区別します** ——
 * `git branch -d` と `-D` は別の操作なので、畳むと片方が緩みます。
 */
export function parseShape(text: string): CommandShape {
  const head: string[] = [];
  const shortFlags = new Set<string>();
  const longFlags: string[] = [];

  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("--")) {
      longFlags.push(token);
    } else if (SHORT_FLAG.test(token)) {
      for (const character of token.slice(1)) shortFlags.add(character);
    } else if (longFlags.length === 0 && shortFlags.size === 0) {
      head.push(token);
    }
  }

  return { head: head.join(" "), shortFlags, longFlags };
}

/**
 * 包みを剥がす。重なっていても中身へ届くよう、変わらなくなるまで繰り返す。
 *
 * @remarks
 * 危ないのは包み自身ではなく包まれた側なので、包みを丸ごと塞ぐと使える用途まで巻き添えになり
 * （`rtk run pnpm build`）、剥がさないと迂回路になります（`rtk run rm -rf /`）。
 */
export function unwrap(segment: string): string {
  let current = segment.trim();

  for (let depth = 0; depth < 8; depth++) {
    const before = current;
    for (const [pattern, replacement] of WRAPPERS) current = current.replace(pattern, replacement);
    current = current.replace(SHELL_C, "$2").trim();
    if (current === before) return current;
  }

  return current;
}

/**
 * 引用と heredoc の本体を落とす。
 *
 * @remarks
 * このリポジトリはコマンド行で文書を書くので（heredoc の中の散文、`echo` の引数）、引用の中まで
 * 見ると文書に危険なコマンド名を書いた瞬間に誤って止まります。
 */
export function stripQuoted(commandLine: string): string {
  return stripQuotes(stripHeredoc(commandLine));
}

/**
 * heredoc の本体だけを落とす。
 *
 * @remarks
 * 本体は改行をまたぐので、**区切りで割る前に**落とします。割ったあとでは `\n` が既に境界に
 * なっていて、散文の 1 行 1 行がコマンド行として現れます。
 */
function stripHeredoc(commandLine: string): string {
  return commandLine.replace(HEREDOC_BODY, " ");
}

/**
 * 引用の中身だけを落とす。
 *
 * @remarks
 * **包みを剥がしたあとの 1 区間に対して掛けます。** `sh -c "..."` の引用は散文ではなくコマンド行
 * そのものなので、剥がす前に掛けると中身ごと消えます。
 */
function stripQuotes(segment: string): string {
  return segment.replace(/'[^']*'/g, " ").replace(/"(?:[^"\\]|\\.)*"/g, " ");
}

/** 包みを剥がすたびに中身がまたコマンド行になるので、その深さの上限。 */
const NEST_LIMIT = 4;

/**
 * コマンド行を、コマンド位置に立つ区間の一覧へ割る。
 *
 * @remarks
 * 順序が要です。**区切りで割り、区間ごとに包みを剥がし、剥がせたものは中身をもう一度割ります。**
 * 包みの中身はコマンド行なので、そこにも区切りが在ります。引用を落とすのは剥がし終えた区間に
 * 対してだけで、`sh -c "..."` の引用を散文として消してしまわないようにしています。
 */
function splitSegments(line: string, depth: number): readonly string[] {
  if (depth > NEST_LIMIT) return [];

  const out: string[] = [];
  for (const raw of line.split(SEPARATOR)) {
    const trimmed = raw.replace(/^[\s&]+/, "").trim();
    if (!trimmed) continue;

    const unwrapped = unwrap(trimmed);
    if (unwrapped !== trimmed) out.push(...splitSegments(unwrapped, depth + 1));
    out.push(stripQuotes(unwrapped));
  }
  return out;
}

/** 断片が、この順で残りの中に全部現れるか。断片が無ければ真。 */
function containsInOrder(rest: string, fragments: readonly string[]): boolean {
  let cursor = 0;
  for (const fragment of fragments) {
    const at = rest.indexOf(fragment, cursor);
    if (at < 0) return false;
    cursor = at + fragment.length;
  }
  return true;
}

/**
 * コマンド行が、塞がれた綴りをコマンド位置に持つか。当たった綴りを返す（無ければ `undefined`）。
 *
 * @remarks
 * 直後が行末か区切りであることを求めるので、`make tag-patch-dry` は `make tag-patch` で止まりません。
 */
export function judge(commandLine: string, literals: readonly Literal[]): string | undefined {
  const shapes = literals.map((literal) => ({ literal, want: parseShape(literal.head) }));
  const segments = splitSegments(stripHeredoc(commandLine), 0);

  for (const segment of segments) {
    const got = parseShape(segment);

    for (const { literal, want } of shapes) {
      if (!segment.startsWith(want.head)) continue;

      const rest = segment.slice(want.head.length);
      // `>` / `<` は前に空白が要らないので境界に含める（`make tag-patch>out.txt`）。
      // 語の途中で終わる綴り（`git switch release/`）は、直後に必ず続きが来るので境界を求めない。
      if (!literal.openEnded && rest !== "" && !/^[\s;&|)<>]/.test(rest)) continue;

      if (!containsInOrder(rest, literal.fragments)) continue;

      if (want.shortFlags.size === 0 && want.longFlags.length === 0) return literal.source;

      const shortSatisfied = [...want.shortFlags].every((character) =>
        got.shortFlags.has(character),
      );
      const longSatisfied = want.longFlags.every((wanted) =>
        got.longFlags.some((present) => present.startsWith(wanted)),
      );
      if (shortSatisfied && longSatisfied) return literal.source;
    }
  }

  return undefined;
}

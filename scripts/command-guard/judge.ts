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

/** 区切りの直後はコマンド位置になる。`(` と backtick は散文に多すぎるので採らない。 */
const SEPARATOR = /(?:\|\||&&|[;|\n]|\$\()/g;

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
const SHELL_C = /^(?:ba)?sh\s+-c\s+(["'])([\s\S]*)\1\s*$/;

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
 * `permissions.deny` の宣言から、コマンド位置で照合する綴りを取り出す。
 *
 * @remarks
 * `Bash(...)` 以外（`Edit(...)` など）は Bash の判定に関係しないので落とします。`*` の手前までを
 * 綴りとするので、`Bash(rm -rf *)` も `Bash(graphify install*)` も同じ扱いになります。
 */
export function deriveLiterals(denyEntries: readonly string[]): readonly string[] {
  const literals = new Set<string>();

  for (const entry of denyEntries) {
    const matched = /^Bash\((.*)\)$/.exec(entry);
    if (!matched) continue;

    const literal = (matched[1] ?? "").split("*")[0]?.trim();
    if (literal) literals.add(literal);
  }

  return [...literals].sort();
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
 * 見ると文書に危険なコマンド名を書いた瞬間に止まります。**誤爆した拒否は迂回の動機になり、迂回
 * されたゲートは無いのと同じです。**
 */
export function stripQuoted(commandLine: string): string {
  return commandLine
    .replace(HEREDOC_BODY, " ")
    .replace(/'[^']*'/g, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, " ");
}

/**
 * コマンド行が、塞がれた綴りをコマンド位置に持つか。当たった綴りを返す（無ければ `undefined`）。
 *
 * @remarks
 * 直後が行末か区切りであることを求めるので、`make tag-patch-dry` は `make tag-patch` で止まりません。
 */
export function judge(commandLine: string, literals: readonly string[]): string | undefined {
  const shapes = literals.map((literal) => ({ literal, want: parseShape(literal) }));
  const segments = stripQuoted(unwrap(commandLine))
    .split(SEPARATOR)
    .map((part) => unwrap(part.replace(/^[\s&]+/, "")));

  for (const segment of segments) {
    if (!segment) continue;
    const got = parseShape(segment);

    for (const { literal, want } of shapes) {
      if (!segment.startsWith(want.head)) continue;

      const rest = segment.slice(want.head.length);
      if (rest !== "" && !/^[\s;&|)]/.test(rest)) continue;

      if (want.shortFlags.size === 0 && want.longFlags.length === 0) return literal;

      const shortSatisfied = [...want.shortFlags].every((character) =>
        got.shortFlags.has(character),
      );
      const longSatisfied = want.longFlags.every((wanted) =>
        got.longFlags.some((present) => present.startsWith(wanted)),
      );
      if (shortSatisfied && longSatisfied) return literal;
    }
  }

  return undefined;
}

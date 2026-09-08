import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const entryCssPath = resolve(repositoryRoot, "src/app/globals.css");
const componentsDirectoryPath = resolve(repositoryRoot, "src/components");

/**
 * CSS を持たないことが分かっている class。
 *
 * @remarks
 * 出力が無いことと、書いてはいけないことは別である。ここに挙げるのは**意図して CSS を持たない
 * class** で、検出結果から外すだけで実装からは消さない。消すと生成物が持っていた情報が失われる。
 */
const KNOWN_WITHOUT_CSS: ReadonlySet<string> = new Set([
  // 子孫の variant から参照されるだけの目印。それ自体は宣言を持たない
  "group",
  "peer",
  // animation plugin を採らないため出力されない。shadcn 生成物が持つ装飾指定
  "animate-in",
  "animate-out",
  "animate-caret-blink",
]);

/** 出力を持たないことが分かっている接頭辞。値ごとに列挙しても意味が無いものだけを置く。 */
const KNOWN_WITHOUT_CSS_PREFIXES: readonly string[] = [
  "fade-in",
  "fade-out",
  "zoom-in",
  "zoom-out",
  "slide-in-from-",
  "slide-out-to-",
  // group/peer に名前を付ける形。目印であって宣言ではない
  "group/",
  "peer/",
];

/**
 * class 名を CSS の selector で使える形へ変換する。
 *
 * @remarks
 * Tailwind は `:` `.` `/` `[` `]` `(` `)` `%` などを含む class を、その文字を `\` で
 * 逃がした selector として出力する。素の文字列で探すと variant 修飾子の付いた class を
 * 取りこぼすため、照合する前に同じ形へ揃える。
 */
export function toSelector(className: string): string {
  return `.${className.replace(/[^\w-]/g, (character) => `\\${character}`)}`;
}

/**
 * variant 修飾子を取り除き、utility の部分だけを返す。
 *
 * @remarks
 * `data-[state=open]:animate-in` の `:` は修飾子の区切りだが、`data-[state=open]` の中の `=`
 * や `[` の内側にも記号が現れる。角括弧・丸括弧の内側は区切りとして数えない。
 */
export function utilityOf(className: string): string {
  let depth = 0;
  let lastSeparator = -1;

  for (let index = 0; index < className.length; index++) {
    const character = className[index];
    if (character === "[" || character === "(") depth++;
    else if (character === "]" || character === ")") depth--;
    else if (character === ":" && depth === 0) lastSeparator = index;
  }

  return className.slice(lastSeparator + 1);
}

/** 意図して CSS を持たない class か。判定は variant 修飾子を外した utility に対して行う。 */
export function isKnownWithoutCss(className: string): boolean {
  const utility = utilityOf(className);
  if (KNOWN_WITHOUT_CSS.has(utility)) return true;
  return KNOWN_WITHOUT_CSS_PREFIXES.some((prefix) => utility.startsWith(prefix));
}

const CLASS_ANCHORS = [
  { pattern: /className=\{/g, open: "{", close: "}" },
  { pattern: /\bcva\(/g, open: "(", close: ")" },
  { pattern: /\bcn\(/g, open: "(", close: ")" },
] as const;

/** 開き括弧の位置から、対応する閉じ括弧までを返す。文字列リテラルの中の括弧は数えない。 */
function balancedSlice(source: string, start: number, open: string, close: string): string {
  let depth = 0;
  let quote: string | undefined;

  for (let index = start; index < source.length; index++) {
    const character = source[index];

    if (quote !== undefined) {
      if (character === "\\") index++;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === open) depth++;
    else if (character === close) {
      depth--;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  return source.slice(start);
}

/**
 * 先頭は utility の頭文字か、任意 variant の `[`、子孫を指す `*`。加えて `2xl:` のように
 * 数字で始まる breakpoint も通す。数字始まりを一律に落とすと、その class は候補に上がらない
 * まま検査を素通りし、ガードが黙って効かなくなる。ただし通すのは `:` を伴う variant 形だけで、
 * `2xl` 単体は utility ではないため落とす（コード中の数値リテラルも同じ判定で落ちる）。
 */
const UTILITY_TOKEN = /^[a-z[*][\w:./[\]()&>*+~=%!#'-]*$/;
const DIGIT_LED_VARIANT_TOKEN = /^\d+[a-z]+:[\w:./[\]()&>*+~=%!#'-]*$/;

/**
 * ソース中の class 候補を取り出す。
 *
 * @remarks
 * ファイル中の文字列リテラルをすべて拾うと、`data-slot` の値・`role`・`aria-*` の属性名まで
 * 候補に入る。class が書かれる位置は `className` 属性か、`cn()` / `cva()` の引数に限られるため、
 * その内側の文字列リテラルだけを見る。判定は生成された CSS との照合で確定させるので、
 * ここでは class としてありえない形だけを落とす。
 */
export function collectClassCandidates(source: string): ReadonlySet<string> {
  const candidates = new Set<string>();
  const literals = [
    ...[...source.matchAll(/(?<=className=")[^"\n]*(?=")/g)].map((match) => match[0]),
    ...classRegionsIn(source).flatMap(classLiteralsIn),
  ];

  for (const literal of literals) {
    for (const token of classTokensIn(literal)) candidates.add(token);
  }

  return candidates;
}

/** 文字列リテラルの中で class としてありうる語。 */
function classTokensIn(value: string): string[] {
  return value
    .split(/\s+/)
    .filter((token) => UTILITY_TOKEN.test(token) || DIGIT_LED_VARIANT_TOKEN.test(token));
}

/**
 * class が書かれうる範囲（`className={…}` と `cn(…)` / `cva(…)` の引数）。
 *
 * @remarks
 * 書かれた順に返す。どの anchor から来たかで並びが変わると、差分が読みにくくなる。
 */
function classRegionsIn(source: string): string[] {
  const regions: { at: number; text: string }[] = [];

  for (const { pattern, open, close } of CLASS_ANCHORS) {
    for (const match of source.matchAll(pattern)) {
      const start = match.index + match[0].length - 1;
      regions.push({ at: start, text: balancedSlice(source, start, open, close) });
    }
  }

  return regions.toSorted((a, b) => a.at - b.at).map(({ text }) => text);
}

/**
 * 範囲の中の文字列リテラルのうち、class として読むものの中身（引用符を除く）。
 *
 * @remarks
 * 比較の対象・index の key・cva の variant 名は、文字列でも class ではないので落とす。
 */
function classLiteralsIn(region: string): string[] {
  // cva の `defaultVariants` が指すのは variant の名前であって class ではない
  const variantNameSpans = [...region.matchAll(/defaultVariants:\s*\{[^}]*\}/g)].map(
    (match) => [match.index, match.index + match[0].length] as const,
  );
  const literals: string[] = [];

  // 逃がした引用符を含む literal を途中で切らない
  for (const match of region.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g)) {
    const start = match.index;
    const end = start + match[0].length;
    const before = region.slice(0, start);
    const after = region.slice(end);

    if (variantNameSpans.some(([from, to]) => start >= from && end <= to)) continue;
    // `orientation === "horizontal" ? …` の比較対象
    if (/[=!]==?\s*$/.test(before)) continue;
    // `ALIGNMENT_CLASS[column.align ?? "start"]` のような index の key。class 側の任意値
    // （`[&_svg:not([class*='size-'])]`）は literal の内側なので、この判定には掛からない
    if (/\[[^[\]"'\n]*$/.test(before) && /^\s*\]/.test(after)) continue;

    // 両端の引用符を落とす
    literals.push(match[0].slice(1, -1));
  }

  return literals;
}

/** `src/components` 配下の `.tsx` を集める。story と test は実装ではないため対象にしない。 */
/* istanbul ignore next -- ファイル走査と CSS の build は pnpm check:classes が実地で通す。 */
async function collectComponentSources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      // biome-ignore lint/performance/noAwaitInLoops: ディレクトリを並列に開くと、component 数ぶんの file descriptor を同時に掴む
      files.push(...(await collectComponentSources(path)));
      continue;
    }
    if (!entry.name.endsWith(".tsx")) continue;
    if (entry.name.endsWith(".stories.tsx") || entry.name.endsWith(".test.tsx")) continue;
    files.push(path);
  }

  return files;
}

/** `globals.css` を実際に build し、生成された CSS を返す。 */
/* istanbul ignore next -- 同上（`collectComponentSources` と同じ）。 */
async function buildCss(): Promise<string> {
  const source = await readFile(entryCssPath, "utf8");
  const result = await postcss([tailwindcss()]).process(source, { from: entryCssPath });

  return result.css;
}

/** 出力に現れなかった class を、書かれているファイルとともに返す。 */
export function findMissingClasses(
  css: string,
  sources: ReadonlyMap<string, ReadonlySet<string>>,
): { className: string; files: string[] }[] {
  const missing = new Map<string, string[]>();

  for (const [file, candidates] of sources) {
    for (const candidate of candidates) {
      if (isKnownWithoutCss(candidate)) continue;
      if (css.includes(toSelector(candidate))) continue;
      missing.set(candidate, [...(missing.get(candidate) ?? []), file]);
    }
  }

  return [...missing]
    .map(([className, files]) => ({ className, files }))
    .sort((a, b) => a.className.localeCompare(b.className));
}

/* istanbul ignore next -- CLI のエントリポイントは pnpm check:classes が実地で通す。 */
async function main(): Promise<void> {
  const css = await buildCss();
  const files = await collectComponentSources(componentsDirectoryPath);
  const sources = new Map<string, ReadonlySet<string>>();

  for (const file of files) {
    // biome-ignore lint/performance/noAwaitInLoops: 全 component のソースを同時に読み込む必要はなく、逐次で足りる
    const source = await readFile(file, "utf8");
    sources.set(relative(repositoryRoot, file), collectClassCandidates(source));
  }

  // 走査が壊れれば対象 0 件で緑になり、検査が消えたことに誰も気付かない。
  if (files.length === 0) {
    process.stderr.write(`走査が component を 1 件も拾っていません: ${componentsDirectoryPath}\n`);
    process.exitCode = 1;
    return;
  }

  const missing = findMissingClasses(css, sources);

  if (missing.length === 0) {
    process.stdout.write(`未定義の class: ありません（${files.length} ファイルを確認）\n`);
    return;
  }

  const lines = [`未定義の class: ${missing.length} 件`];
  for (const { className, files: where } of missing) {
    lines.push(`  ${className}`, ...where.map((file) => `    ${file}`));
  }
  lines.push(
    "",
    "CSS が出ないため、面が透明になる・focus ring が出ない・状態が見えないといった欠陥が黙って入る。",
    "意図して CSS を持たない class なら、消さずに check-classes.ts の KNOWN_WITHOUT_CSS へ理由とともに足す。",
  );
  process.stderr.write(`${lines.join("\n")}\n`);
  process.exitCode = 1;
}

/* istanbul ignore next -- 同上（`main` と同じ）。 */
if (process.argv[1]?.endsWith("check-classes.ts")) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node

// `.claude/**` のスキル / エージェント定義を意味的に検査する lint スクリプト。
// markdownlint は体裁しか見ないため、「書いてある内容が実態と合っているか」は誰も検査していない。
// スキル定義はエージェントの挙動を決める指示書であり、腐った参照はそのまま誤った手順の実行につながる。
//
// 検査は Makefile のターゲット一覧・ファイルシステム・見出し抽出・確定済みの採番規約から導出できる
// ものだけに限る（判断を含めない）。node の標準ライブラリのみに依存する。
// 1 件でも違反があれば非 0 で終了する。
import fs from "node:fs";
import path from "node:path";

import {
  eachLineOutsideFence,
  extractHeadings,
  parseFrontmatterKeys,
  splitFrontmatter,
} from "./document-structure.js";
import {
  expandBraces,
  isTooComplex,
  placeholderToRegExp,
  scanInlineCode,
  WILDCARD_RE,
} from "./reference-pattern.js";

type Finding = {
  file: string;
  line: number;
  rule: string;
  message: string;
};

type MakeTargets = {
  exact: Set<string>;
  patterns: RegExp[];
};

const REPO_ROOT = process.cwd();
const CLAUDE_DIR = ".claude";
const SKILLS_DIR = path.join(CLAUDE_DIR, "skills");
const AGENTS_DIR = path.join(CLAUDE_DIR, "agents");

// ファイル索引・参照検査から外すディレクトリ（VCS 内部 / 外部依存 / 生成物 / 実行時成果物）。
const EXCLUDE_DIRS = new Set([".git", "node_modules", ".next", "tmp", "graphify-out"]);

// 同じく外す、リポジトリ相対パスの先頭一致。worktree は別ブランチの作業ツリーなので、
// 実在しても「このブランチのソース」ではない。索引にも直接の fs 参照にも通すと、
// このブランチに無いファイルへの参照が実在すると判定され、しかもその可否が
// 作業マシンにどの worktree が生きているかで変わる。
const EXCLUDE_PREFIXES: string[] = [path.join(CLAUDE_DIR, "worktrees")];

function isExcludedPrefix(rel: string): boolean {
  return EXCLUDE_PREFIXES.some((p) => rel === p || rel.startsWith(`${p}${path.sep}`));
}

// 参照検査の対象外にする先頭セグメント。tmp/ と graphify-out/ の配下は実行時に生成されるため、
// 静的なファイルシステム検査では存在しないのが正常。生成済みの環境でだけ検査が通ることを避けるため、
// 実在するかどうかに関わらず対象外にする。
const PATH_ROOT_DENY = new Set(["tmp", ".git", "graphify-out"]);

// 追跡していない生成物のうち、参照先として名指しされるもの。portal の成果物は `docs/` の内側にあり、
// `docs/` 自体は検査したいので PATH_ROOT_DENY（先頭セグメント）では表せない。
//
// 配下ではなく**この 2 つだけ**を完全一致で許すのは、`guides/` の中身が manifest の `dst` から一意に
// 決まる決定的な集合だからである。前方一致で配下ごと許すと、`guides/` を指す綴り違いや改名後の
// 陳腐化した参照が恒久的に検出されなくなる（`tmp/` のように中身が不定形な出力とはここが違う）。
const GENERATED_ARTIFACT_PATHS = new Set(["docs/portal/guides", "docs/portal/docs.json"]);

// 意図的に実在しない参照（仮定の例示・任意配置）を抑止するための行内ディレクティブ。
const IGNORE_DIRECTIVE = "<!-- skill-lint-ignore -->";

// 検査する 1 行の長さの上限。行の内容も書き手が自由に決められ、正規表現の照合は行長に対して
// 二次時間まで落ちる。このリポジトリは公開されており md-lint は fork からの PR でも走るため、
// 極端に長い 1 行は CI と pre-commit を止める手段になる。上限超過は検査を飛ばさず違反として
// 報告する（黙って通すと「長く書けば検査を外せる」抜け道になる）。
const MAX_LINE_LENGTH = 4096;

const findings: Finding[] = [];

function report(file: string, line: number, rule: string, message: string): void {
  findings.push({ file, line, rule, message });
}

// ---------------------------------------------------------------------------
// 共通ユーティリティ
// ---------------------------------------------------------------------------

function readFile(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function listDirs(rel: string): string[] {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

// REPO_ROOT 配下の全エントリ（ファイル + ディレクトリ）をリポジトリ相対パスで索引化する。
// glob / プレースホルダを含む参照は実パス解決ができないため、この索引に対する正規表現照合で判定する。
function buildEntryIndex(): string[] {
  const entries: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(REPO_ROOT, abs);
      if (isExcludedPrefix(rel)) continue;
      entries.push(rel);
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        walk(abs);
      }
    }
  };
  walk(REPO_ROOT);
  return entries;
}

// ---------------------------------------------------------------------------
// frontmatter
// ---------------------------------------------------------------------------

// name / description の必須検査と配置名（ディレクトリ名 / ファイル名）との一致検査。
function checkFrontmatter(rel: string, content: string, expectedName: string): void {
  const fm = splitFrontmatter(content);
  if (!fm) {
    report(rel, 1, "frontmatter", "frontmatter (`---` で囲まれたブロック) がありません");
    return;
  }
  const keys = parseFrontmatterKeys(fm.lines);
  for (const required of ["name", "description"]) {
    if (!keys.has(required) || keys.get(required) === "") {
      report(rel, 1, "frontmatter", `frontmatter に \`${required}\` がありません（または空です）`);
    }
  }
  const name = keys.get("name");
  if (name !== undefined && name !== "" && name !== expectedName) {
    report(
      rel,
      1,
      "frontmatter",
      `frontmatter の \`name: ${name}\` が配置名 \`${expectedName}\` と一致しません`,
    );
  }
}

// ---------------------------------------------------------------------------
// 対訳ペア
// ---------------------------------------------------------------------------

// 対訳（SKILL.ja.md）が canonical（SKILL.md）と 1:1 であることを検査する。
// ファイルの有無だけでは節の欠落・ずれを検出できないため、見出しレベル列の一致まで見る。
function checkTranslationPair(canonicalRel: string, translationRel: string): void {
  if (!fs.existsSync(path.join(REPO_ROOT, translationRel))) {
    report(
      canonicalRel,
      1,
      "translation",
      `対訳 \`${path.basename(translationRel)}\` がありません`,
    );
    return;
  }
  const translation = readFile(translationRel);

  if (splitFrontmatter(translation)) {
    report(
      translationRel,
      1,
      "translation",
      "対訳に frontmatter があります（スキルとして読み込まれるのは canonical 側だけです）",
    );
  }

  const firstLine = translation.split("\n").find((l) => l.trim() !== "") ?? "";
  if (!firstLine.startsWith(">") || !firstLine.includes(path.basename(canonicalRel))) {
    report(
      translationRel,
      1,
      "translation",
      `冒頭に canonical (\`${path.basename(canonicalRel)}\`) を指す翻訳注記（引用行）がありません`,
    );
  }

  const canonicalHeadings = extractHeadings(readFile(canonicalRel));
  const translationHeadings = extractHeadings(translation);
  const max = Math.max(canonicalHeadings.length, translationHeadings.length);
  for (let i = 0; i < max; i++) {
    const en = canonicalHeadings[i];
    const ja = translationHeadings[i];
    if (en && ja && en.level === ja.level) continue;
    const enDesc = en ? `L${en.lineNo} ${"#".repeat(en.level)} ${en.text}` : "（無し）";
    const jaDesc = ja ? `L${ja.lineNo} ${"#".repeat(ja.level)} ${ja.text}` : "（無し）";
    report(
      translationRel,
      ja ? ja.lineNo : 1,
      "translation",
      `見出し構造が canonical とずれています（${i + 1} 番目 / canonical ${canonicalHeadings.length} 見出し・対訳 ${translationHeadings.length} 見出し）\n` +
        `      canonical: ${enDesc}\n` +
        `      対訳:      ${jaDesc}`,
    );
    return;
  }
}

// ---------------------------------------------------------------------------
// 参照: make ターゲット
// ---------------------------------------------------------------------------

// Makefile / .makefiles/**/*.mk からターゲット名を集める。
// `%` を含むパターンルールは正規表現として保持する。
function collectMakeTargets(): MakeTargets {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (entry.name.endsWith(".mk")) files.push(abs);
    }
  };
  const makefilesDir = path.join(REPO_ROOT, ".makefiles");
  if (fs.existsSync(makefilesDir)) walk(makefilesDir);
  // ルートの makefile は綴りが処理系依存（`makefile` / `Makefile`）。macOS は大文字小文字を
  // 区別しないため、Linux の CI で初めて読み落とすことがないよう実エントリ名で拾う。
  for (const name of fs.readdirSync(REPO_ROOT)) {
    if (name === "makefile" || name === "Makefile" || name === "GNUmakefile") {
      files.push(path.join(REPO_ROOT, name));
    }
  }

  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  const addTarget = (name: string) => {
    if (name === "" || name.startsWith(".")) return;
    if (name.includes("%")) {
      patterns.push(
        new RegExp(
          `^${name
            .split("%")
            .map((p) => p.replace(/[.*+^${}()|[\]\\?]/g, "\\$&"))
            .join(".+")}$`,
        ),
      );
      return;
    }
    exact.add(name);
  };

  for (const file of files) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (line.startsWith("\t")) continue;
      const phony = /^\.PHONY:\s*(.+)$/.exec(line);
      if (phony) {
        for (const name of phony[1].split("##")[0].trim().split(/\s+/)) addTarget(name);
        continue;
      }
      const rule = /^([A-Za-z0-9_%.+/ -]+):(?!=)/.exec(line);
      if (rule) {
        for (const name of rule[1].trim().split(/\s+/)) addTarget(name);
      }
    }
  }
  return { exact, patterns };
}

const makeTargets = collectMakeTargets();

function makeTargetExists(target: string): boolean {
  return expandBraces(target).every((candidate) => {
    if (makeTargets.exact.has(candidate)) return true;
    if (makeTargets.patterns.some((pattern) => pattern.test(candidate))) return true;
    if (!WILDCARD_RE.test(candidate)) return false;
    // 参照側がプレースホルダ（`tag-<level>` / `branch-*`）の場合は、
    // それに当てはまる実ターゲットが 1 つでもあれば実在と見なす。
    const re = placeholderToRegExp(candidate, { segmentSeparator: false });
    return (
      [...makeTargets.exact].some((t) => re.test(t)) ||
      makeTargets.patterns.some((p) => re.test(p.source.replace(/[$^\\]/g, "")))
    );
  });
}

// インラインコードの `make ...` からターゲット名を取り出す。
// 変数代入（`DRY_RUN=1`）やシェル演算子（`2>&1` / `|`）以降は make の引数ではないため打ち切る。
function extractMakeTargets(span: string): string[] {
  if (!/^make(\s|$)/.test(span)) return [];
  const targets: string[] = [];
  for (const token of span.split(/\s+/).slice(1)) {
    if (token.startsWith("-")) continue;
    if (!/^[A-Za-z0-9_%.<>{},*/-]+$/.test(token)) break;
    targets.push(token);
  }
  return targets;
}

// ---------------------------------------------------------------------------
// 参照: ファイルパス
// ---------------------------------------------------------------------------

const entryIndex = buildEntryIndex();
const rootEntries = new Set(fs.readdirSync(REPO_ROOT).filter((name) => !PATH_ROOT_DENY.has(name)));
const basenameIndex = new Set(entryIndex.map((entry) => path.basename(entry)));

// ディレクトリを伴わない設定ファイル名（`mise.toml` / `biome.ci.jsonc`）の実在性を判定する。
// 設定ファイルはリポジトリ内で名前が一意に定まるため、配置を書かずに名前だけで参照されることが多く、
// SSOT が移動・改名しても本文だけが古い名前で残りやすい。
const CONFIG_FILE_RE = /^[.\w][\w.-]*\.(ya?ml|toml|jsonc?)$/;

function configFileExists(name: string): boolean {
  return expandBraces(name).some((candidate) => {
    if (!WILDCARD_RE.test(candidate)) return basenameIndex.has(candidate);
    const re = placeholderToRegExp(candidate, { segmentSeparator: true });
    return [...basenameIndex].some((base) => re.test(base));
  });
}

// インラインコードが検査可能なパス参照かどうかを判定する。
// 相対ファイル名（`SKILL.md` など文脈依存の記述）は解決先が一意に決まらないため対象外にし、
// 先頭セグメントが実在するルート直下エントリであるものだけを検査する。
// さらに、パスと同形だが実体がファイルではない記述を次の規則で除外する:
//   - 末尾セグメントに `.` も末尾 `/` も無いもの — モジュール指定子（`next/image`）と区別できない
//   - `...` を含むもの — 「以下同様」を表す省略記法
//   - `<name>` プレースホルダを含むもの — `src/features/<name>/actions.ts` のような表記は
//     [0027](../../docs/adr/0027-directory-structure.md) が定める規約上の配置であって、実在ファイルの参照ではない
//   - 未作成のカーネルを指すもの — isUncreatedKernelPath を参照
function asRepoPath(span: string): string | null {
  let text = span.trim();
  if (text.startsWith("./")) text = text.slice(2);
  if (!text.includes("/")) return null;
  if (/<[^>]*>/.test(text)) return null;
  if (/[\s$\\#?!"'()|`:;@]/.test(text)) return null;
  if (text.includes("...")) return null;
  const isDirRef = text.endsWith("/");
  if (isDirRef) text = text.slice(0, -1);
  if (!rootEntries.has(text.split("/")[0])) return null;
  if (!isDirRef && !path.basename(text).includes(".")) return null;
  if (isUncreatedKernelPath(text)) return null;
  return text;
}

// `src/` 直下のカーネル（`config` / `features` 等）と境界エントリ（`proxy.ts` / `instrumentation.ts`）は、
// その決定が着地した時点で作られる（[0027](../../docs/adr/0027-directory-structure.md) / [0043](../../docs/adr/0043-middleware-policy.md)）。
// まだ無いものへの参照は「これから置く場所」であって実在ファイルの主張ではないため検査しない。
// 実体化した時点で配下のパスは自動的に検査対象へ入り、以後は rename / 削除が検出される
// （= 骨組みの現状を恒久ルールとして焼き込まない）。
function isUncreatedKernelPath(text: string): boolean {
  const segments = text.split("/");
  if (segments[0] !== "src" || segments.length < 2) return false;
  return !fs.existsSync(path.join(REPO_ROOT, segments[0], segments[1]));
}

// パス参照の実在性を判定する。スキルは自身が同梱するファイル（`prompts/verify-arch.md` など）も
// 同じ表記で参照するため、リポジトリルート相対に加えて参照元ファイルのディレクトリ相対でも解決する。
function repoPathExists(candidate: string, fromDir: string): boolean {
  const bases = [REPO_ROOT, path.join(REPO_ROOT, fromDir)];
  return expandBraces(candidate).some((text) => {
    if (GENERATED_ARTIFACT_PATHS.has(text)) return true;
    if (!WILDCARD_RE.test(text))
      return bases.some((base) => {
        const abs = path.join(base, text);
        if (isExcludedPrefix(path.relative(REPO_ROOT, abs))) return false;
        return fs.existsSync(abs);
      });
    const re = placeholderToRegExp(text, { segmentSeparator: true });
    return entryIndex.some((entry) => re.test(entry));
  });
}

// ---------------------------------------------------------------------------
// 参照: ADR 採番
// ---------------------------------------------------------------------------

// 廃止済みの ADR 採番プレフィックス。採番はトピック別ブロック帯の数値 4 桁へ全面再付番済みで
// （`docs/adr/0028-naming-convention.md`）、プレフィックス付きの採番は現行に 1 つも存在しない。
// 参照先が実在しないことが綴りだけで確定するため、判断を挟まずに違反と断定できる。
// 廃止された 2 つに限定するのは、`[A-Z]\w+-\d{4}` のような一般形が規格番号や型番を巻き込むため。
const RETIRED_ADR_NUMBER_RE = /\b(?:Toolchain|Dev)-\d{4}\b/g;

// ---------------------------------------------------------------------------
// 参照: Markdown リンク
// ---------------------------------------------------------------------------

// 末尾の任意タイトル（`[a](b "title")`）まで含めて 1 つのリンクとして取る。タイトル付きを
// 取りこぼすと、その行のリンクだけ実在検査を素通りする。
const MD_LINK_RE = /\[[^\]]*\]\(\s*([^()\s]+)(?:\s+"[^"]*")?\s*\)/g;

// リンクターゲットのうち、リポジトリ内のファイルとして解決できるものだけを取り出す。
// ページ内アンカー・スキーム付き URL・プロトコル相対 URL・プレースホルダ入りは実パスに解決できない。
function asLinkPath(target: string): string | null {
  if (target.startsWith("#")) return null;
  if (target.startsWith("//")) return null;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)) return null;
  // `<...>` で囲む書き方は CommonMark のリンク先エスケープであって、書き手が埋めるプレースホルダ
  // （`docs/<name>/x.md`）とは別物。囲みを外してから中身をプレースホルダとして判定する。
  const unwrapped = /^<[^<>]*>$/.test(target) ? target.slice(1, -1) : target;
  if (/<[^>]*>/.test(unwrapped)) return null;
  const withoutFragment = unwrapped.split("#")[0];
  return withoutFragment === "" ? null : withoutFragment;
}

// リンク先の実在性を判定する。相対リンクの基準は参照元ファイルのディレクトリ、`/` 始まりは
// リポジトリルート（GitHub の解決規則）。パス参照と違ってルート相対でも解決を試すことはしない
// ── リンクは表示時に実際に辿られるため、解決規則から外れた当たりを実在と見なすと壊れたリンクを通す。
// 解決結果がリポジトリルートの外へ出た場合も false を返す。索引の外にあるものは実在を主張できない。
function linkPathExists(target: string, fromDir: string): boolean {
  const abs = target.startsWith("/")
    ? path.join(REPO_ROOT, target)
    : path.resolve(REPO_ROOT, fromDir, target);
  const rel = path.relative(REPO_ROOT, abs);
  if (rel.startsWith("..")) return false;
  if (isExcludedPrefix(rel)) return false;
  // tmp/ 配下はスキル実行中に生成されるため、静的検査では存在しないのが正常。
  if (PATH_ROOT_DENY.has(rel.split(path.sep)[0])) return true;
  return fs.existsSync(abs);
}

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------

// `.claude/**` の Markdown 本文が参照する make ターゲット / ファイルパス / リンク先の実在性と、
// 廃止済み ADR 採番の不使用を検査する。
// frontmatter も対象にする。`description` はスキル選択時にモデルへ渡る要約であり、本文と同じだけ腐る。
// 抑止ディレクティブ（HTML コメント）は YAML スカラの中では機能しないため、frontmatter で誤検知が
// 出た場合は記述側を直して回避する。
function checkReferences(rel: string): void {
  const content = readFile(rel);
  const fromDir = path.dirname(rel);
  for (const { line, lineNo } of eachLineOutsideFence(content)) {
    if (line.includes(IGNORE_DIRECTIVE)) continue;
    if (line.length > MAX_LINE_LENGTH) {
      report(
        rel,
        lineNo,
        "line-length",
        `1 行が長すぎて検査できません（${line.length} 文字 / 上限 ${MAX_LINE_LENGTH} 文字）`,
      );
      continue;
    }
    // 採番だけは行全体を見る。廃止採番はコードスパンに書かれていても実在しない ADR を指しており、
    // リンクと違って「記法の例示」という正当な用途が無い。
    for (const match of line.matchAll(RETIRED_ADR_NUMBER_RE)) {
      report(
        rel,
        lineNo,
        "adr-ref",
        `廃止された ADR 採番を参照しています: \`${match[0]}\`（現行の採番は数値 4 桁のみ）`,
      );
    }
    const { spans, withoutCode } = scanInlineCode(line);
    // コードスパンの中のリンクはリンク記法そのものの例示であり、実在するファイルを指す主張ではない。
    for (const match of withoutCode.matchAll(MD_LINK_RE)) {
      const target = asLinkPath(match[1]);
      if (target !== null && !linkPathExists(target, fromDir)) {
        report(rel, lineNo, "link-ref", `存在しないパスへリンクしています: \`${match[1]}\``);
      }
    }
    for (const span of spans) {
      for (const target of extractMakeTargets(span)) {
        if (isTooComplex(target)) {
          report(
            rel,
            lineNo,
            "make-ref",
            `ワイルドカードが多すぎて検査できません: \`make ${target}\``,
          );
          continue;
        }
        if (!makeTargetExists(target)) {
          report(
            rel,
            lineNo,
            "make-ref",
            `存在しない make ターゲットを参照しています: \`make ${target}\``,
          );
        }
      }
      const repoPath = asRepoPath(span);
      if (repoPath !== null && isTooComplex(repoPath)) {
        report(rel, lineNo, "path-ref", `ワイルドカードが多すぎて検査できません: \`${span}\``);
        continue;
      }
      if (repoPath !== null && !repoPathExists(repoPath, fromDir)) {
        report(rel, lineNo, "path-ref", `存在しないパスを参照しています: \`${span}\``);
        continue;
      }
      if (
        repoPath === null &&
        CONFIG_FILE_RE.test(span) &&
        !isTooComplex(span) &&
        !configFileExists(span)
      ) {
        report(
          rel,
          lineNo,
          "path-ref",
          `リポジトリに存在しない設定ファイルを参照しています: \`${span}\``,
        );
      }
    }
  }
}

function collectClaudeMarkdown(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(REPO_ROOT, abs);
      if (isExcludedPrefix(rel)) continue;
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        walk(abs);
        continue;
      }
      if (entry.name.endsWith(".md")) out.push(rel);
    }
  };
  const abs = path.join(REPO_ROOT, CLAUDE_DIR);
  if (!fs.existsSync(abs)) {
    console.error(
      `✘ skill-lint: ${CLAUDE_DIR}/ が見つかりません（リポジトリルートで実行してください）`,
    );
    process.exit(2);
  }
  walk(abs);
  return out.sort();
}

const skillDirs = listDirs(SKILLS_DIR);
for (const name of skillDirs) {
  const canonicalRel = path.join(SKILLS_DIR, name, "SKILL.md");
  if (!fs.existsSync(path.join(REPO_ROOT, canonicalRel))) {
    report(path.join(SKILLS_DIR, name), 1, "structure", "`SKILL.md` がありません");
    continue;
  }
  checkFrontmatter(canonicalRel, readFile(canonicalRel), name);
  checkTranslationPair(canonicalRel, path.join(SKILLS_DIR, name, "SKILL.ja.md"));
}

const agentFiles = fs.existsSync(path.join(REPO_ROOT, AGENTS_DIR))
  ? fs
      .readdirSync(path.join(REPO_ROOT, AGENTS_DIR))
      .filter((name) => name.endsWith(".md") && !name.endsWith(".ja.md"))
      .sort()
  : [];
for (const file of agentFiles) {
  const rel = path.join(AGENTS_DIR, file);
  checkFrontmatter(rel, readFile(rel), file.replace(/\.md$/, ""));
}

const markdownFiles = collectClaudeMarkdown();
for (const rel of markdownFiles) checkReferences(rel);

if (findings.length > 0) {
  console.error(`✘ skill-lint: ${findings.length} 件の違反\n`);
  let current: string | null = null;
  for (const finding of findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
    if (finding.file !== current) {
      if (current !== null) console.error("");
      console.error(`  ${finding.file}`);
      current = finding.file;
    }
    console.error(`    :${finding.line}  [${finding.rule}] ${finding.message}`);
  }
  console.error(
    `\n検査 ${skillDirs.length} スキル / ${agentFiles.length} エージェント / ${markdownFiles.length} Markdown 中 ${findings.length} 件 NG`,
  );
  process.exit(1);
}

console.log(
  `✓ skill-lint: ${skillDirs.length} スキル / ${agentFiles.length} エージェント / ${markdownFiles.length} Markdown すべて OK`,
);

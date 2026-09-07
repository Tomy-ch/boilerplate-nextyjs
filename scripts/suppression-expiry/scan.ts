// 抑止の宣言を、それを置いてよい面から読み取る。判定は rules.ts、ここは読み取りだけを担う。
//
// **面は 2 種類に分かれる。** 撤回条件をデータとして持つ面はその形式のパーサで宣言単位に読み、
// コメントとして持つ面は日付を含む行だけを取り出す（`COMMENT_BORNE_PATHS`）。
//
// 冷却の免除（pnpm の `minimumReleaseAgeExclude` と mise.toml の pin）は両者の中間にある ——
// 宣言そのものはデータだが、理由と撤回条件は隣のコメントが持つ。宣言の位置を生の行で突き止めて
// 直上のコメント塊を添えることで、宣言単位に読む。
//
// 自前の文字列切り出しはしない。TOML のヘッダは角括弧の内側に空白を書けるし、値の中の `"` は
// エスケープできる。位置を数える実装はそのどちらも読み落とし、エラーを出さずに 0 件を返す。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";

import { MISE_FILE, type MisePin, pinId, readPins } from "../lib/mise-pins.js";
import type { Suppression } from "./rules.js";

/** リポジトリの根。この層だけが実ファイルの位置を知る。 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** 依存の脆弱性の抑止（osv-scanner）。 */
const OSV_PATH = "osv-scanner.toml";
/** 依存の脆弱性の抑止（trivy）。 */
const TRIVY_PATH = ".trivyignore.yaml";
/** 検出 1 件ごとの抑止（bearer）。 */
const BEARER_PATH = "bearer.ignore";
/** 動的スキャンの所見の抑止。 */
const ZAP_PATH = ".github/zap/rules.tsv";
/** 依存の冷却期間の免除（pnpm）。 */
const PNPM_PATH = "pnpm-workspace.yaml";

/**
 * 撤回条件をコメントとして持つ面。
 *
 * @remarks
 * 抑止の様式が「理由をその場のコメントに書く」ものです。**宣言単位では読めません** —— コメントは
 * 構文木に残らないので、パーサを通した時点で理由が消えます。したがってこれらの面から一覧に載るのは
 * 日付を含む行だけで（対象名は `L<行>`）、日付を持たない条件（「上流が N 以上を要求したら」など）は
 * 見えません。見えないこと自体を報告へ書き出すのは `index.ts` の仕事です。
 *
 * `pnpm-workspace.yaml` がここに居るのは `overrides` のためです。冷却の免除は宣言単位で読み、
 * その行はこちらの読み取りから外します。
 */
const COMMENT_BORNE_PATHS = [
  ".gitleaks.toml",
  ".gitleaksignore",
  ".github/zizmor.yml",
  PNPM_PATH,
  "sonar-project.properties",
] as const;

/** 宣言単位では読めない面。報告がこれを名指しする。 */
export const COMMENT_BORNE_SOURCES: readonly string[] = COMMENT_BORNE_PATHS;

/** 日付の並び。行がこれを含むときだけ、コメントを宣言として拾う。 */
const DATE_IN_LINE = /\d{4}-\d{2}-\d{2}/;

function read(root: string, relativePath: string): string {
  const absolute = path.join(root, relativePath);

  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
}

/**
 * 形式として読めなかった面を、空として扱う。
 *
 * @remarks
 * **落とさずに空を返します。** 1 つの面が壊れているせいで週次の点検そのものが止まると、他の面の
 * 期限まで見られなくなります。壊れていること自体は、その形式を所有するツール（osv-scanner /
 * trivy / bearer / pnpm / mise）が自分のゲートで報告します。
 */
function parsed<T>(text: string, parse: (source: string) => unknown): T | undefined {
  if (text === "") {
    return undefined;
  }

  try {
    return parse(text) as T;
  } catch {
    return undefined;
  }
}

/** 脆弱性 ID ごとの抑止（osv-scanner）。理由は `reason`。 */
function osvSuppressions(root: string): readonly Suppression[] {
  const document = parsed<{ IgnoredVulns?: { id?: string; reason?: string }[] }>(
    read(root, OSV_PATH),
    parseToml,
  );

  return (document?.IgnoredVulns ?? []).map((entry) => ({
    source: OSV_PATH,
    subject: entry.id ?? "(id なし)",
    condition: entry.reason ?? "",
  }));
}

/** 脆弱性 ID ごとの抑止（trivy）。理由は `statement`。 */
function trivySuppressions(root: string): readonly Suppression[] {
  const document = parsed<{ vulnerabilities?: { id?: string; statement?: string }[] }>(
    read(root, TRIVY_PATH),
    parseYaml,
  );

  return (document?.vulnerabilities ?? []).map((entry) => ({
    source: TRIVY_PATH,
    subject: entry.id ?? "(id なし)",
    condition: entry.statement ?? "",
  }));
}

/** 検出 1 件ごとの抑止（bearer）。理由は `comment`。 */
function bearerSuppressions(root: string): readonly Suppression[] {
  const document = parsed<Record<string, { comment?: string }>>(
    read(root, BEARER_PATH),
    JSON.parse,
  );

  return Object.entries(document ?? {}).map(([fingerprint, entry]) => ({
    source: BEARER_PATH,
    subject: fingerprint,
    condition: entry.comment ?? "",
  }));
}

/**
 * 規則ごとの抑止（ZAP）。理由は 3 列目。
 *
 * @remarks
 * **解説かどうかは前後の空白を落として決め、列は生の行から切ります。** 判定を生の行へ当てると
 * 行頭に空白のある解説が規則番号として混ざり、逆に行ごと落としてから切ると、先頭の空列が
 * 潰れて 2 列目が規則番号に繰り上がります。
 */
function zapSuppressions(root: string): readonly Suppression[] {
  return read(root, ZAP_PATH)
    .split("\n")
    .filter((line) => {
      const decided = line.trim();

      return decided !== "" && !decided.startsWith("#");
    })
    .flatMap((line) => {
      const [subject, , condition] = line.split("\t");

      return subject === undefined || subject === ""
        ? []
        : [{ source: ZAP_PATH, subject, condition: condition ?? "" }];
    });
}

/** YAML の並びの 1 項目の行。引用の有無を問わず、行末コメントがあればそれも取る。 */
function listItemLine(entry: string): RegExp {
  const literal = entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`^\\s*-\\s*(?:"${literal}"|'${literal}'|${literal})\\s*(?:#\\s*(.*))?$`);
}

/** 直上に続くコメント塊。行番号（1 始まり）と、`#` を落として繋いだ本文。 */
function commentBlockAbove(
  lines: readonly string[],
  index: number,
): { readonly numbers: number[]; readonly text: string } {
  const texts: string[] = [];
  const numbers: number[] = [];

  for (const [offset, raw] of lines.slice(0, index).reverse().entries()) {
    const trimmed = raw.trim();

    if (!trimmed.startsWith("#")) break;

    texts.unshift(trimmed.replace(/^#\s?/, ""));
    numbers.unshift(index - offset);
  }

  return { numbers, text: texts.join(" ").trim() };
}

/**
 * 冷却期間の免除（pnpm）。宣言は `minimumReleaseAgeExclude` の項目、理由は直上のコメント塊と
 * 行末のコメント。
 *
 * @remarks
 * pnpm の宣言は文字列の並びで、理由を載せる欄を持ちません。同じファイルの `overrides` と同じく
 * コメントに書き、宣言の行を生の行から突き止めて添えます。**突き止められない項目は条件を空にして
 * 載せます** —— flow 記法（`[a@1]`）で書かれた項目は行を持たず、様式違反として `rules.ts` が
 * 落とします。
 *
 * @returns 宣言と、宣言単位の読み取りが消費した行。消費した行はコメント行の読み取りから外す
 */
function pnpmExemptions(root: string): {
  readonly suppressions: readonly Suppression[];
  readonly consumed: ReadonlySet<number>;
} {
  const text = read(root, PNPM_PATH);
  const document = parsed<{ minimumReleaseAgeExclude?: unknown }>(text, parseYaml);
  const declared = document?.minimumReleaseAgeExclude;
  const entries = Array.isArray(declared)
    ? declared.filter((entry): entry is string => typeof entry === "string")
    : [];
  const lines = text.split("\n");
  const consumed = new Set<number>();
  let searchFrom = 0;

  const suppressions = entries.map((entry): Suppression => {
    const pattern = listItemLine(entry);
    const found = lines
      .map((line, at) => ({ at, match: at >= searchFrom ? pattern.exec(line) : null }))
      .find((candidate): candidate is { at: number; match: RegExpExecArray } => {
        return candidate.match !== null;
      });

    if (found === undefined) {
      return { source: PNPM_PATH, subject: entry, condition: "", kind: "cooldown-exemption" };
    }

    searchFrom = found.at + 1;

    const trailing = (found.match[1] ?? "").trim();
    const block = commentBlockAbove(lines, found.at);

    for (const number of [...block.numbers, found.at + 1]) consumed.add(number);

    return {
      source: PNPM_PATH,
      subject: entry,
      condition: [block.text, trailing].filter((part) => part !== "").join(" "),
      kind: "cooldown-exemption",
    };
  });

  return { suppressions, consumed };
}

/**
 * 冷却期間の免除（mise）。宣言は pin の直上のコメント塊にある `tools-cooldown-ignore:`。
 *
 * @remarks
 * 読み方は [`lib/mise-pins.ts`](../lib/mise-pins.ts) が持ち、冷却の検査と同じ関数を通します。
 */
function miseExemptions(root: string): readonly Suppression[] {
  const pins = parsed<readonly MisePin[]>(read(root, MISE_FILE), readPins);

  return (pins ?? []).flatMap((pin): Suppression[] =>
    pin.ignore === null
      ? []
      : [
          {
            source: MISE_FILE,
            subject: pinId(pin),
            condition: pin.ignore.condition,
            kind: "cooldown-exemption",
          },
        ],
  );
}

/**
 * 条件をコメントに持つ面（`COMMENT_BORNE_PATHS`）から、日付を含む行を拾う。
 *
 * @param consumed - 面ごとに、宣言単位の読み取りが既に読んだ行。二重に載せない
 */
function commentBorneSuppressions(
  root: string,
  consumed: ReadonlyMap<string, ReadonlySet<number>>,
): readonly Suppression[] {
  return COMMENT_BORNE_PATHS.flatMap((source) => {
    const skipped = consumed.get(source) ?? new Set<number>();

    return read(root, source)
      .split("\n")
      .map((line, index) => ({ text: line.trim(), number: index + 1 }))
      .filter(({ text, number }) => DATE_IN_LINE.test(text) && !skipped.has(number))
      .map(({ text, number }) => ({ source, subject: `L${number}`, condition: text }));
  });
}

/**
 * 抑止の宣言を、面をまたいで 1 つの一覧へ均す。
 *
 * @param root - 読みに行くリポジトリの根。既定は自分が置かれているリポジトリ
 */
export function scanSuppressions(root: string = REPO_ROOT): readonly Suppression[] {
  const pnpm = pnpmExemptions(root);

  return [
    ...osvSuppressions(root),
    ...trivySuppressions(root),
    ...bearerSuppressions(root),
    ...zapSuppressions(root),
    ...pnpm.suppressions,
    ...miseExemptions(root),
    ...commentBorneSuppressions(root, new Map([[PNPM_PATH, pnpm.consumed]])),
  ];
}

// 抑止の宣言を、それを置いてよい面から読み取る。判定は rules.ts、ここは読み取りだけを担う。
//
// **面は 2 種類に分かれる。** 撤回条件をデータとして持つ面はその形式のパーサで宣言単位に読み、
// コメントとして持つ面は日付を含む行だけを取り出す（`COMMENT_BORNE_PATHS`）。
//
// 自前の文字列切り出しはしない。TOML のヘッダは角括弧の内側に空白を書けるし、値の中の `"` は
// エスケープできる。位置を数える実装はそのどちらも読み落とし、エラーを出さずに 0 件を返す。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";

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

/**
 * 撤回条件をコメントとして持つ面。
 *
 * @remarks
 * 抑止の様式が「理由をその場のコメントに書く」ものです。**宣言単位では読めません** —— コメントは
 * 構文木に残らないので、パーサを通した時点で理由が消えます。したがってこれらの面から一覧に載るのは
 * 日付を含む行だけで（対象名は `L<行>`）、日付を持たない条件（「上流が N 以上を要求したら」など）は
 * 見えません。見えないこと自体を報告へ書き出すのは `index.ts` の仕事です。
 */
const COMMENT_BORNE_PATHS = [
  ".gitleaks.toml",
  ".gitleaksignore",
  ".github/zizmor.yml",
  "pnpm-workspace.yaml",
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
 * trivy / bearer）が自分のゲートで報告します。
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

/** 条件をコメントに持つ面（`COMMENT_BORNE_PATHS`）から、日付を含む行を拾う。 */
function commentBorneSuppressions(root: string): readonly Suppression[] {
  return COMMENT_BORNE_PATHS.flatMap((source) =>
    read(root, source)
      .split("\n")
      .map((line, index) => ({ text: line.trim(), number: index + 1 }))
      .filter(({ text }) => DATE_IN_LINE.test(text))
      .map(({ text, number }) => ({ source, subject: `L${number}`, condition: text })),
  );
}

/**
 * 抑止の宣言を、面をまたいで 1 つの一覧へ均す。
 *
 * @param root - 読みに行くリポジトリの根。既定は自分が置かれているリポジトリ
 */
export function scanSuppressions(root: string = REPO_ROOT): readonly Suppression[] {
  return [
    ...osvSuppressions(root),
    ...trivySuppressions(root),
    ...bearerSuppressions(root),
    ...zapSuppressions(root),
    ...commentBorneSuppressions(root),
  ];
}

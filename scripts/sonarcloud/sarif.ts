/**
 * 所見の一覧を、code scanning が取り込める SARIF へ直す。
 *
 * @remarks
 * 取り込ませる先はリポジトリの security タブで、そこは所見を**ファイルと行**に結び付けて出します。
 * だから位置の綴りが要求どおりでなければ、所見は数だけ増えて場所を失います。
 */

import { fieldOf, itemsOf, numberOf, textOf } from "./payload.js";

/** 深刻度と、code scanning が持つ 3 段の対応。 */
const LEVELS: Record<string, string> = {
  BLOCKER: "error",
  CRITICAL: "error",
  MAJOR: "warning",
  MINOR: "note",
  INFO: "note",
};

/** 表に無い深刻度の段。落とさず、目立たせすぎもしない側へ寄せる。 */
const DEFAULT_LEVEL = "warning";

/** 深刻度が付いていない所見の扱い。 */
const DEFAULT_SEVERITY = "MAJOR";

/** 規則名が読めない所見の扱い。SARIF は `ruleId` を空にできない。 */
const DEFAULT_RULE = "unknown";

/** 位置を持たない所見を置く行。 */
const FIRST_LINE = 1;

const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
const SARIF_VERSION = "2.1.0";
const DRIVER_NAME = "SonarQube Cloud";

type SarifRule = {
  readonly id: string;
  readonly helpUri: string;
};

type SarifResult = {
  readonly ruleId: string;
  readonly level: string;
  readonly message: { readonly text: string };
  readonly locations: readonly {
    readonly physicalLocation: {
      readonly artifactLocation: { readonly uri: string };
      readonly region: { readonly startLine: number };
    };
  }[];
};

/** code scanning へ渡す 1 回ぶんの走査結果。 */
export type SarifLog = {
  readonly $schema: string;
  readonly version: string;
  readonly runs: readonly {
    readonly tool: {
      readonly driver: {
        readonly name: string;
        readonly informationUri: string;
        readonly rules: readonly SarifRule[];
      };
    };
    readonly results: readonly SarifResult[];
  }[];
};

/** 深刻度を code scanning の段へ移す。 */
export function severityLevel(severity: string): string {
  return LEVELS[severity] ?? DEFAULT_LEVEL;
}

/**
 * `<projectKey>:<path>` からリポジトリ相対のパスを取り出す。
 *
 * @remarks
 * **project key を綴りとして探して消しません。** key は利用者が決める文字列で、正規表現の
 * 特殊文字を含みえます。逃がし損ねが 1 文字あれば、すべての所見が黙って別の場所を指します。
 * `:` で切って先頭を落とせば、key の中身に関わらず同じ結果になります。
 */
export function componentPath(component: string): string {
  const parts = component.split(":");

  return parts.length > 1 ? parts.slice(1).join(":") : component;
}

/**
 * 所見の一覧を SARIF へ直す。
 *
 * @param payload - `/api/issues/search` の応答
 * @param serverUrl - 規則の説明を引くための待ち受け先
 */
export function toSarif(payload: unknown, serverUrl: string): SarifLog {
  const issues = itemsOf(fieldOf(payload, "issues"));

  return {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: DRIVER_NAME,
            informationUri: serverUrl,
            rules: rulesOf(issues, serverUrl),
          },
        },
        results: issues.map(toResult),
      },
    ],
  };
}

/** 所見が名乗った規則を重複なく並べる。SARIF は結果の `ruleId` がここに在ることを求める。 */
function rulesOf(issues: readonly unknown[], serverUrl: string): SarifRule[] {
  return [...new Set(issues.map(ruleOf))]
    .sort()
    .map((id) => ({ id, helpUri: `${serverUrl}/coding_rules?open=${id}` }));
}

function ruleOf(issue: unknown): string {
  return textOf(fieldOf(issue, "rule"), DEFAULT_RULE);
}

function toResult(issue: unknown): SarifResult {
  return {
    ruleId: ruleOf(issue),
    level: severityLevel(textOf(fieldOf(issue, "severity"), DEFAULT_SEVERITY)),
    message: { text: textOf(fieldOf(issue, "message"), "") },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: componentPath(textOf(fieldOf(issue, "component"), "")) },
          region: { startLine: lineOf(issue) },
        },
      },
    ],
  };
}

/**
 * 所見を置く行。
 *
 * @remarks
 * ファイル全体に対する所見には行が付きません。**それでも 1 行目へ置きます** —— 行の無い結果は
 * 取り込みで落ち、指摘そのものが消えます。
 */
function lineOf(issue: unknown): number {
  return numberOf(
    fieldOf(issue, "line"),
    numberOf(fieldOf(fieldOf(issue, "textRange"), "startLine"), FIRST_LINE),
  );
}

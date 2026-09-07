import { z } from "zod";

/**
 * `pnpm audit --json` の出力を読み、ゲートの判定に落とす。
 *
 * @remarks
 * 閾値は **severity と修正可能性の 2 つ**で定めています。go の govulncheck が持つ到達可能性の
 * フィルタは `pnpm audit` に無く、osv-scanner の call analysis も JS/TS に対応していないため、
 * この 2 つが現行ツールで引ける最も細い線です。
 *
 * 修正版の無いものを blocking から外すのは、その場で直せないものでゲートを組むと `--no-verify`
 * と同じ経路（無視する運用）を CI 側に作るためです。可視化は続けます —— 落とさないことと
 * 見せないことは別です。
 */

/** `pnpm audit --json` の 1 件。判定に使う欄だけを受け取る。 */
const rawAdvisorySchema = z.object({
  module_name: z.string(),
  severity: z.string(),
  title: z.string(),
  url: z.string(),
  patched_versions: z.string(),
  findings: z.array(z.object({ paths: z.array(z.string()) })).optional(),
});

/**
 * `pnpm audit --json` の全体。
 *
 * @remarks
 * `advisories` を optional にしてあるのは、検出が 0 件のとき pnpm がこのキーごと落とすためです。
 * 必須にすると「脆弱性が無い」が「出力が壊れている」として落ちます。
 */
const auditSchema = z.object({
  advisories: z.record(z.string(), rawAdvisorySchema).optional(),
});

/**
 * 修正版が存在しないことを表す npm の印。
 *
 * @remarks
 * 「該当なし」を空文字ではなく**満たしようのない範囲**で表す綴りで、advisory DB 側の約束です。
 */
const NO_PATCH = "<0.0.0";

/** blocking へ上げる severity。 */
const BLOCKING_SEVERITIES: ReadonlySet<string> = new Set(["high", "critical"]);

/** 検出 1 件。 */
export type Advisory = {
  /** 脆弱性を持つパッケージ名。 */
  readonly module: string;
  /** advisory DB の severity。 */
  readonly severity: string;
  /** 見出し。 */
  readonly title: string;
  /** advisory のページ。 */
  readonly url: string;
  /** 修正版の範囲。修正版が無ければ `undefined`。 */
  readonly patched: string | undefined;
  /** この依存へ至る経路。 */
  readonly paths: readonly string[];
};

/**
 * 出力を読む。
 *
 * @param text - `pnpm audit --json` の標準出力。
 * @returns module 名の昇順に並べた検出。
 * @throws 形が合わない場合。
 */
export function parseAudit(text: string): Advisory[] {
  const parsed = auditSchema.parse(JSON.parse(text));

  return Object.values(parsed.advisories ?? {})
    .map((raw) => ({
      module: raw.module_name,
      severity: raw.severity,
      title: raw.title,
      url: raw.url,
      patched: raw.patched_versions === NO_PATCH ? undefined : raw.patched_versions,
      paths: (raw.findings ?? []).flatMap((finding) => finding.paths),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

/** その検出がマージを止めるか。 */
export function isBlocking(advisory: Advisory): boolean {
  return BLOCKING_SEVERITIES.has(advisory.severity) && advisory.patched !== undefined;
}

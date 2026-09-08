// モデルに読ませる価値のあるターンを、決定的に選ぶ判定。
//
// **意味の分類はモデルがするが、何を読ませるかはモデルに選ばせない**
// （[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 2）。窓 1 件でも人の発話は数十件あり、
// 全部を渡せば費用が見合わない。ここで絞ってから渡すのは節約のためだけではなく、**絞りが決定的なら
// 「なぜこのターンが選ばれたか」を後から説明できる**からでもある。
//
// 選ぶのは 3 種類 —— 人が是正した発話、中断の直前、道具が失敗した直後。いずれも
// 「うまくいかなかった瞬間」の代理指標であって摩擦そのものではないので、**見落としもする**。
// 取りこぼしを許してでも読む量を抑える、という判断である。

import type { Event } from "./events.js";

/** なぜこのターンが選ばれたか。モデルへ渡すときに添える。 */
type CandidateReason = "是正" | "中断の直前" | "失敗の直後";

/** モデルに読ませる 1 件。 */
export type Candidate = {
  readonly at: number;
  readonly reason: CandidateReason;
  readonly text: string;
};

/**
 * 人が是正したことを示す語。
 *
 * @remarks
 * 丁寧な訂正、質問の形をした指摘、黙って直した場合は捕まりません。ここは網羅ではなく
 * **読む価値が高い順に絞る**ための足切りで、**語を増やすほど絞りが緩みます**。
 */
const CORRECTIVE_MARKERS: readonly string[] = [
  "違う",
  "ではなく",
  "じゃなく",
  "勘違い",
  "間違",
  "戻して",
  "そうじゃ",
  "誤読",
  "なんで",
  "要らな",
  "不要",
];

/**
 * 人ではなくハーネスが差し込んだ本文の目印。
 *
 * @remarks
 * `user` の記録には、人が打ったものだけでなくハーネスが差し込んだものも混ざります。これらは
 * 人の発話ではないので、**是正の語を含んでいても摩擦の証拠になりません**。
 */
const INJECTED_MARKERS: readonly string[] = [
  "<task-notification>",
  "<local-command-caveat>",
  "<command-name>",
  "<system-reminder>",
  "This session is being continued from a previous conversation",
];

/**
 * 秘密らしき形。
 *
 * @remarks
 * 候補はモデルへ渡され、読解の結果は public な issue へ出ます。**疑わしきは落とす**を崩さない
 * こと —— 落とした 1 件は他の候補で埋まりますが、**出てしまった 1 件は取り消せません**
 * （[0110](../../docs/adr/0110-security-operations.md)）。
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{16,}/,
  /\bgithub_pat_\w{20,}/,
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bASIA[0-9A-Z]{16}\b/,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s:@/]+:[^\s:@/]+@/,
  // 単語境界を前に置かないのは、環境変数名の形をした鍵を取り逃さないため —— `\btoken\b` は
  // `SONAR_TOKEN=` に当たらない。
  /(?:token|secret|credential|password|passwd|api[_-]?key)\s*[:=]\s*["']?[\w\-.+/]{12,}/i,
  // `pass` / `pwd` は語として短く、`passing` や `cwd` に当たる。前後を区切って
  // `DB_PASS=` や `pwd:` の形だけを拾う。
  /(?:^|[\s_\-.])(?:pass|pwd)\s*[:=]\s*["']?[\w\-.+/]{8,}/i,
  // `curl -u user:secret` の形。URL の userinfo とは別の経路で、こちらは `://` を持たない。
  /\s-u\s+[^\s:@/]+:[^\s]{6,}/,
  /\bBearer\s+[\w\-.=]{20,}/i,
];

/** 既定の上限。1 窓ぶんとして読ませても費用が見合う量。 */
const DEFAULT_LIMIT = 40;

/** 1 件あたりの本文の長さ。 */
const DEFAULT_EXCERPT_CHARS = 600;

/** ハーネスが差し込んだ本文か。 */
export function isInjected(text: string): boolean {
  return INJECTED_MARKERS.some((marker) => text.includes(marker));
}

/** 秘密らしき形を含むか。 */
export function looksSecret(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

/** 本文が是正の合図を含むか。差し込まれた本文は人の発話ではないので含めない。 */
export function isCorrective(text: string): boolean {
  return !isInjected(text) && CORRECTIVE_MARKERS.some((marker) => text.includes(marker));
}

/**
 * 本文を要約せずに切り詰める。
 *
 * @remarks
 * 切るのは長さだけで、意味には触れません。**要約はモデルの仕事**であり、ここで先に要約すると
 * 「決定的に選んだ」と言えなくなります。
 */
export function excerpt(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, " ").trim();

  return flat.length <= maxChars ? flat : `${flat.slice(0, maxChars)}…`;
}

/**
 * 読ませる候補を選ぶ。
 *
 * @param events - 窓に属する出来事。時刻順である必要はない
 * @param limit - 上限。多い場合は 是正 → 中断の直前 → 失敗の直後 の順に残す
 * @param maxChars - 1 件あたりの本文の長さ
 *
 * @remarks
 * 優先順位は**「人が明示的に是正した」を最上位**に置きます。中断と失敗は機械が観測した兆候に
 * すぎませんが、**是正は人がそう言った事実**だからです。
 */
export function selectCandidates(
  events: readonly Event[],
  limit: number = DEFAULT_LIMIT,
  maxChars: number = DEFAULT_EXCERPT_CHARS,
): readonly Candidate[] {
  const ordered = [...events].sort((a, b) => a.at - b.at);
  const prompts = ordered.filter(
    (event) =>
      event.kind === "prompt" &&
      event.text !== undefined &&
      event.text !== "" &&
      !isInjected(event.text) &&
      // 秘密らしき本文は、どの理由に当たっても候補にしない。
      !looksSecret(event.text),
  );

  const corrective: Candidate[] = [];
  const beforeInterrupt: Candidate[] = [];
  const afterFailure: Candidate[] = [];
  const taken = new Set<number>();

  const push = (into: Candidate[], event: Event, reason: CandidateReason): void => {
    if (taken.has(event.at)) {
      return;
    }

    taken.add(event.at);
    into.push({ at: event.at, reason, text: excerpt(event.text ?? "", maxChars) });
  };

  for (const prompt of prompts) {
    if (isCorrective(prompt.text ?? "")) {
      push(corrective, prompt, "是正");
    }
  }

  // 中断の直前の発話。何を止めたのかは、その手前で人が言ったことに書いてある。
  for (const event of ordered) {
    if (event.kind !== "interrupt") {
      continue;
    }

    const prior = [...prompts].reverse().find((prompt) => prompt.at <= event.at);

    if (prior !== undefined) {
      push(beforeInterrupt, prior, "中断の直前");
    }
  }

  // 失敗の直後の発話。人がそこで何と言ったかに、失敗の意味が現れる。
  for (const event of ordered) {
    if (event.kind !== "tool_result" || event.ok !== false) {
      continue;
    }

    const next = prompts.find((prompt) => prompt.at >= event.at);

    if (next !== undefined) {
      push(afterFailure, next, "失敗の直後");
    }
  }

  return [...corrective, ...beforeInterrupt, ...afterFailure].slice(0, Math.max(limit, 0));
}

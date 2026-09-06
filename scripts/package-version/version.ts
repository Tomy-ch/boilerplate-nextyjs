// リリースブランチ名から `package.json` の version を決める判断。
// 版の出所をブランチ名へ一本化する理由は [0150](../../docs/adr/0150-git-workflow.md)。

import { normalizeVersion } from "../semver/bump.js";

/**
 * リリース版を名乗るブランチ。
 *
 * @remarks
 * `release` と `hotfix` の双方を数えます。どちらも出荷される版であり、片方だけを数えると
 * hotfix で出した版だけが `package.json` に載らないまま残ります。捕まえるのは版らしき文字列
 * までで、読めるかどうかの判断は呼び出し元の `deriveVersion` が持ちます。
 */
const RELEASE_BRANCH_PATTERN = /^(?:release|hotfix)\/(v.+)$/;

/**
 * `package.json` の version フィールド。桁は 2 で固定（最上位の直下）。
 *
 * @remarks
 * 値だけを捉えて前後をそのまま残します。JSON として組み直すと整形と鍵の並びが書き手の手を
 * 離れ、版以外の差分が出ます。
 */
const VERSION_FIELD = /^ {2}"version": "([^"]*)"/m;

/** 走らせ方。書くだけか、書いてコミットまでするか、突き合わせるだけか。 */
export type StampMode = "stamp" | "commit" | "check";

const STAMP_MODES: readonly StampMode[] = ["stamp", "commit", "check"];

/** 引数として渡された値が走らせ方の指定になっているか。 */
export function isStampMode(value: string): value is StampMode {
  return (STAMP_MODES as readonly string[]).includes(value);
}

/** 走らせ方が踏む副作用。plan が `write` のときに、どこまで進むかを決める。 */
export type StampEffects = {
  readonly write: boolean;
  readonly commit: boolean;
};

/**
 * 走らせ方から、書き換えとその記録をどこまで行うかを決める。
 *
 * @remarks
 * **`check` が書かないことがこの機構の要です。**突き合わせるだけのはずの CI が `package.json`
 * を書き換えると、検査が検査対象を作ってしまいます。入口へ置くと検査の母数から外れ
 * （[untested-modules.ts](../lib/untested-modules.ts) の入口の線引き）、この 1 行を誰も
 * 見張らなくなります。
 */
export function stampEffects(mode: StampMode): StampEffects {
  return { write: mode !== "check", commit: mode === "commit" };
}

/**
 * 版を導く ref を、優先順に選ぶ。
 *
 * @remarks
 * ブランチ名は**シェルを経由せず**環境変数として届きます（引数で渡さない理由は
 * [.makefiles/README.md](../../.makefiles/README.md) の「版の焼き込み関連」）。優先順をここへ
 * 置くのは、渡し口が増えても選び方が 1 箇所に残るためです。
 *
 * @param candidates - 優先順に並べた候補。空文字列と `undefined` は「指定なし」として次へ送る
 * @returns 最初に指定されていた候補。1 つも無ければ `null`
 */
export function selectRef(candidates: readonly (string | undefined)[]): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();

    if (trimmed !== undefined && trimmed !== "") {
      return trimmed;
    }
  }

  return null;
}

/**
 * ブランチ名から焼き込むべき版を導く。
 *
 * @remarks
 * リリース版を名乗らない ref は「刻まない」であって「エラー」ではないため `null` を返し、
 * 落とすかどうかを呼び出し側に選ばせます。feature ブランチの PR でも同じ検査が走ります。
 *
 * 版として読めるかの判断は [bump.ts](../semver/bump.ts) へ委ねます。ここで綴り直すと、
 * リリースを切る側が読める表記とこちらが読める表記が別々に動きます。
 */
export function deriveVersion(ref: string): string | null {
  const captured = RELEASE_BRANCH_PATTERN.exec(ref)?.[1];

  return captured === undefined ? null : normalizeVersion(captured);
}

/**
 * `package.json` の本文から現在の version を読む。
 *
 * @returns 該当行が無ければ `null`。
 */
export function readVersion(manifest: string): string | null {
  return VERSION_FIELD.exec(manifest)?.[1] ?? null;
}

/**
 * `package.json` の本文の version を差し替える。
 *
 * @remarks
 * 置換値は関数で渡します。版の文字列に `$&` のような置換パターンが混ざっても、文字列として
 * そのまま書き込むためです。
 */
export function replaceVersion(manifest: string, version: string): string {
  return manifest.replace(VERSION_FIELD, () => `  "version": "${version}"`);
}

/** 焼き込みを記録するコミットの subject。 */
export function stampCommitMessage(version: string): string {
  return `Chore: package.json の version を ${version} に合わせる`;
}

/** 書き込む前に決まること。書き込まない 3 つを、理由ごとに分けて持つ。 */
export type StampPlan =
  | { readonly kind: "skip"; readonly ref: string }
  | { readonly kind: "unchanged"; readonly version: string }
  | { readonly kind: "missing" }
  | {
      readonly kind: "write";
      readonly from: string;
      readonly to: string;
      readonly content: string;
    };

/**
 * ref と現在の本文から、書き換えるべきかどうかを決める。
 *
 * @remarks
 * 「対象外の ref だから何もしない」「既に同じ版だから何もしない」「version が無くて書けない」は、
 * 書き込まない点では同じですが最後だけは失敗です。入口で畳むと、この 3 つを取り違えても
 * 誰も気づけません。
 *
 * **`unchanged` を `write` と分けているのは、コミットするかどうかがここで決まるためでもあります。**
 * 書き換えが起きていないのにコミットへ進むと、ステージに何も無いまま `git commit` が落ち、
 * リリースブランチを切る手順がその場で止まります。
 *
 * 本文は `readManifest` から遅延で受け取ります。対象外の ref では読まずに終える必要があり、
 * その順序は呼び出し側の書き方ではなくここが持ちます。
 */
export function planStamp(ref: string, readManifest: () => string): StampPlan {
  const version = deriveVersion(ref);

  if (version === null) {
    return { kind: "skip", ref };
  }

  const manifest = readManifest();
  const current = readVersion(manifest);

  if (current === null) {
    return { kind: "missing" };
  }

  if (current === version) {
    return { kind: "unchanged", version };
  }

  return { kind: "write", from: current, to: version, content: replaceVersion(manifest, version) };
}

/** 人へ出す 1 件。落とすかどうかも併せて持つ。 */
export type StampReport = {
  readonly message: string;
  readonly failed: boolean;
};

/**
 * 決まったことを、走らせ方に応じた report へ落とす。
 *
 * @remarks
 * **同じ plan でも、書く側と突き合わせる側で意味が反転するのは `write` だけです。**
 * 書く側にとっては仕事そのもの、突き合わせる側にとっては「焼き込み忘れ」を意味します。
 * 反転をここに置くのは、CI が読む文面と手元で出る文面を 1 箇所から出すためです。
 */
export function reportPlan(plan: StampPlan, mode: StampMode): StampReport {
  if (plan.kind === "skip") {
    return {
      message: `⏭️ ${plan.ref} はリリース版を名乗らないので version は据え置きます`,
      failed: false,
    };
  }

  if (plan.kind === "missing") {
    return { message: "❌ package.json に version がありません", failed: true };
  }

  if (plan.kind === "unchanged") {
    return { message: `✅ version はブランチ名どおり ${plan.version} です`, failed: false };
  }

  if (mode === "check") {
    return {
      message: [
        `❌ version がブランチ名と食い違っています（package.json: ${plan.from} / ブランチ: ${plan.to}）`,
        "➡️ make version-stamp を実行し、差分をコミットしてください",
      ].join("\n"),
      failed: true,
    };
  }

  return { message: `✏️ version: ${plan.from} → ${plan.to}`, failed: false };
}

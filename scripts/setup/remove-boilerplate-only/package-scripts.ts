// 剥がしで呼び先が消える npm script の段の除去。
//
// 宣言をここへ置くのは、[pins](pins.ts) / [egress](egress.ts) と同じ理由である —— `package.json`
// は JSON なのでマーカーを持てない。**JSON として読み書きせず本文の置換で済ませる**のは、読み書き
// すると鍵の順も字下げも書き手の意図から離れ、剥がしと無関係な差分が出るためである。

/** 剥がしと同時に呼び先が消える npm script の段。 */
export type OrphanedScriptStep = {
  /** `package.json` の `scripts` の鍵。報告にだけ使う。 */
  script: string;
  /** 落とす綴り。前の ` && ` ごと落とす。 */
  step: string;
};

/**
 * 剥がしと同時に呼び先が消える段。
 *
 * @remarks
 * `scripts/premise-lint` は前提の綴りを入力として持つ検査で、守っている相手は**前提を書きうる側**
 * です。複製した時点で前提は失効し終えているので、剥がしが済んだ木に見張る対象は残りません。
 */
export const ORPHANED_SCRIPT_STEPS: readonly OrphanedScriptStep[] = [
  { script: "lint:md", step: "tsx scripts/premise-lint" },
];

/** 宣言した段が本文に無いことを表す。 */
export class MissingScriptStepError extends Error {
  constructor(step: string) {
    super(`package.json: 宣言した段が見つかりません（script が動いた可能性があります）: ${step}`);
    this.name = "MissingScriptStepError";
  }
}

/**
 * `package.json` の本文から、宣言した段を落とす。
 *
 * @param text - `package.json` の中身。
 * @param steps - 落とす段。
 * @returns 書き戻す中身。
 *
 * @throws MissingScriptStepError 宣言した段が 1 つでも本文に無いとき。
 *
 * @remarks
 * 落とすのは段と、**その前の `&&`** です。段だけを抜くと `&& &&` が残ります。先頭の段を宣言した
 * ときは前に `&&` が無いので、後ろ側の `&&` を落とします。
 */
export function dropOrphanedScriptSteps(
  text: string,
  steps: readonly OrphanedScriptStep[],
): string {
  return steps.reduce((content, { step }) => {
    for (const needle of [` && ${step}`, `${step} && `, step]) {
      if (content.includes(needle)) return content.replace(needle, "");
    }

    throw new MissingScriptStepError(step);
  }, text);
}

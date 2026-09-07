// 抑止の撤回条件が満たされたか、宣言が様式を満たしているかの判定。読み取りは `scan.ts` が持ち、
// ここは受け取った宣言だけを見る。

import { latestDateIn } from "../lib/withdrawal-date.js";

/** 抑止の宣言 1 件。どの面から来たかと、添えられた撤回条件を持つ。 */
export type Suppression = {
  /** 宣言が置かれている面。報告でそのまま出す。 */
  readonly source: string;
  /**
   * 抑止している対象。
   *
   * @remarks
   * 面によって粒度が違います —— 脆弱性 ID（osv-scanner / trivy）、検出のフィンガープリント
   * （bearer）、規則番号（ZAP）、`<name>@<version>`（冷却の免除）、行ラベル `L<行>`（条件を
   * コメントに持つ面）。
   */
  readonly subject: string;
  /** 撤回条件として添えられた散文。 */
  readonly condition: string;
  /**
   * 冷却の免除。
   *
   * @remarks
   * 供給網の冷却期間を特定の版について外す宣言です。他の抑止と違い、**撤回条件は日付でしか
   * 書けません** —— 免除が要るのは版が窓の内側に居るあいだだけで、窓が明けた日が撤回の日です。
   * 対象も版を名指しする必要があります。名前だけの免除はその名前の将来の版まで外します。
   */
  readonly kind?: "cooldown-exemption";
};

/** 撤回してよいと判定した宣言。 */
export type ExpiredSuppression = Suppression & {
  /** 条件に書かれていた日付。 */
  readonly dueDate: string;
};

/** 様式を満たしていない宣言。 */
export type MalformedSuppression = Suppression & {
  /** 何が欠けているか。1 件の宣言に複数ありうる。 */
  readonly defects: readonly string[];
};

/** 冷却の免除の対象の形。名前に続けて版を名指しする。 */
const VERSIONED_SUBJECT = /^[^@\s]+@\S+/;

/**
 * 撤回条件を満たした宣言を選ぶ。
 *
 * @remarks
 * **判定できるのは日付だけです。** 日付で決まらない条件はここでは満たされたと判定しないので、
 * **呼ぶ側は絞り込んだ結果だけでなく全件も出します**
 * （`index.ts`）。
 *
 * @param suppressions - 読み取った宣言の全件
 * @param today - 判定の基準日（`YYYY-MM-DD`）
 */
export function expiredSuppressions(
  suppressions: readonly Suppression[],
  today: string,
): readonly ExpiredSuppression[] {
  return suppressions.flatMap((suppression) => {
    const dueDate = latestDateIn(suppression.condition);

    if (dueDate === undefined || dueDate > today) {
      return [];
    }

    return [{ ...suppression, dueDate }];
  });
}

/**
 * 様式を満たしていない宣言を選ぶ。
 *
 * @remarks
 * 理由と撤回条件の**有無**を見ます。妥当かどうかはレビューの判断に残しますが、書かれていない
 * ことまでは機械が落とします —— 空の宣言は、その面の検査を黙って外したのと同じです。
 *
 * 冷却の免除は加えて、対象が版を名指ししていること・条件に日付があることを要求します。
 * 免除の撤回条件は窓が明ける日付でしか書けないので、日付の無い免除は撤回条件を持ちません。
 *
 * @param suppressions - 読み取った宣言の全件
 */
export function malformedSuppressions(
  suppressions: readonly Suppression[],
): readonly MalformedSuppression[] {
  return suppressions.flatMap((suppression) => {
    const defects: string[] = [];

    if (suppression.condition.trim() === "") {
      defects.push("理由と撤回条件が書かれていない");
    }

    if (suppression.kind === "cooldown-exemption") {
      if (!VERSIONED_SUBJECT.test(suppression.subject)) {
        defects.push("対象が版を名指ししていない（<name>@<version> の形で書く）");
      }

      if (latestDateIn(suppression.condition) === undefined) {
        defects.push("撤回条件に日付が無い（窓が明ける日を YYYY-MM-DD で書く）");
      }
    }

    return defects.length === 0 ? [] : [{ ...suppression, defects }];
  });
}

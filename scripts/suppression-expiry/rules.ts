// 抑止の撤回条件が満たされたかの判定。読み取りは `scan.ts` が持ち、ここは受け取った宣言だけを見る。

/** 抑止の宣言 1 件。どの面から来たかと、添えられた撤回条件を持つ。 */
export type Suppression = {
  /** 宣言が置かれている面。報告でそのまま出す。 */
  readonly source: string;
  /**
   * 抑止している対象。
   *
   * @remarks
   * 面によって粒度が違います —— 脆弱性 ID（osv-scanner / trivy）、検出のフィンガープリント
   * （bearer）、規則番号（ZAP）、行ラベル `L<行>`（条件をコメントに持つ面）。
   */
  readonly subject: string;
  /** 撤回条件として添えられた散文。 */
  readonly condition: string;
};

/** 撤回してよいと判定した宣言。 */
export type ExpiredSuppression = Suppression & {
  /** 条件に書かれていた日付。 */
  readonly dueDate: string;
};

/** 条件の中の日付。年月日だけを見る —— 時刻まで書く宣言は無い。 */
const DATE_PATTERN = /(\d{4})-(\d{2})-(\d{2})/g;

/**
 * 条件に書かれた日付のうち、最も遅いもの。
 *
 * @remarks
 * **最も遅いものを取ります。** 条件は「公開が 2026-08-29 で、冷却が明ける 2026-09-05 以降」の
 * ように複数の日付を含みます。早い側を取ると、まだ来ていない期限を過ぎたと報告します。
 *
 * @param condition - 撤回条件の散文
 * @returns `YYYY-MM-DD`。日付を含まなければ `undefined`
 */
function latestDateIn(condition: string): string | undefined {
  const dates = [...condition.matchAll(DATE_PATTERN)].map((match) => match[0]).sort();

  return dates.at(-1);
}

/**
 * 撤回条件を満たした宣言を選ぶ。
 *
 * @remarks
 * **判定できるのは日付だけです。** 「上流が N 以上を要求したら」「サンプル破棄が働いた後」の
 * ような条件は、ここでは満たされたと判定しません。判定できないものを黙って落とすと、条件を
 * 書いた意味が消えるので、**呼ぶ側は全件を一覧として出します**（`index.ts`）。
 *
 * 比較を日付の文字列どうしで行うのは、`YYYY-MM-DD` が辞書順と時系列順で一致するためです。
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

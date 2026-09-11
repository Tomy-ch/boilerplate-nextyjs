// 実装タスクの issue が、テンプレートの必須項目を実際に持っているかの判定。
//
// テンプレートの `required: true` が縛るのは GitHub の Web フォームだけで、
// `gh issue create --body-file` は素通りする。**そしてそれが AI が起票する経路である。**
// 欄が空のまま起票された issue は、後から台帳を作る側からは「決定が散文のみだったのか、
// 書き忘れたのか」が区別できない。

/** 検査する issue 1 件。 */
export type IssueBody = {
  /** issue 番号。報告でそのまま出す。 */
  readonly number: number;
  /** issue のタイトル。実装タスクかどうかの判定に使う。 */
  readonly title: string;
  readonly body: string;
};

/** 欄を欠いている issue。 */
export type MissingField = {
  readonly number: number;
  readonly title: string;
  /** 欠けている見出し。 */
  readonly field: string;
};

/**
 * 実装タスクのテンプレートが必須にしている見出し。
 *
 * @remarks
 * **`.github/ISSUE_TEMPLATE/implementation_task.yaml` の `required: true` と対で持ちます。**
 * 片方だけ増やすと、フォーム経由と CLI 経由で必須の集合が食い違います。
 */
export const REQUIRED_HEADINGS: readonly string[] = ["目的", "強制手段", "完了条件"];

/** 実装タスクの issue かどうか。タイトルが計画 ID で始まるものだけを見る。 */
function isImplementationTask(title: string): boolean {
  return /^\[P\d+-\d+/.test(title);
}

/**
 * 必須の見出しを欠いている issue を選ぶ。
 *
 * @remarks
 * 見出しの有無だけを見て、中身の質は見ません。**空欄で起票できてしまうことがこの検査の対象**で、
 * 書かれた内容が妥当かはレビューが持ちます。
 *
 * @param issues - 検査する issue
 * @returns 欠けている組み合わせ。issue 1 件が複数の欄を欠けば、その数だけ返る
 */
export function missingRequiredFields(issues: readonly IssueBody[]): readonly MissingField[] {
  return issues
    .filter((issue) => isImplementationTask(issue.title))
    .flatMap((issue) =>
      REQUIRED_HEADINGS.filter((heading) => !issue.body.includes(`### ${heading}`)).map(
        (field) => ({ number: issue.number, title: issue.title, field }),
      ),
    );
}

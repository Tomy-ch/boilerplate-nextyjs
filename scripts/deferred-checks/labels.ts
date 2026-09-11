/**
 * PR が持つラベルの読み取り。
 *
 * @remarks
 * ワークフローが `toJSON(github.event.pull_request.labels.*.name)` を環境変数へ渡します。
 * 読む側を入口ファイルから切り出してあるのは、入口が検査の対象外だからです
 * （`scripts/README.md`「検査から外すもの」）。判定を入口に残すと、恒久的に無検査になります。
 */

/**
 * ラベルの一覧を読む。読めなかったことは「1 枚も付いていない」へ倒す。
 *
 * @param raw - `toJSON` が書いた JSON。渡されていなければ `undefined`
 * @returns ラベル名。読めなければ空
 *
 * @remarks
 * 倒れる先は知らせる側で、黙る側ではありません —— 取り違えても余分なコメントが 1 件出るだけ
 * です。`pull_request` 以外のイベントで
 * `toJSON` が書くのは文字列 `"null"` で、これも同じ扱いになります。
 */
export function parseLabels(raw: string | undefined): string[] {
  try {
    const labels: unknown = JSON.parse(raw ?? "[]");

    return Array.isArray(labels) ? labels.filter((label) => typeof label === "string") : [];
  } catch {
    return [];
  }
}

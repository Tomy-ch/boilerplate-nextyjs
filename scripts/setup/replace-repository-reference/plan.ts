// 1 ファイルぶんの書き換えの組み立て。走査とファイル入出力は index.ts が担い、ここは
// 「本文を渡すと書き換えた本文が返る」判定だけを持つ。

import { applyPortalUrl } from "./portal.js";
import { applyRepositoryReference } from "./reference.js";

/** 書き換えの結果。`occurrences` は書き換えた箇所の数。 */
export type PlannedReplacement = {
  content: string;
  occurrences: number;
};

/**
 * リポジトリ参照の置換と portal リンクの差し替えを、この順に適用する。
 *
 * @remarks
 * **順序が効きます。** portal を先に置くと、差し込んだ URL の `<owner>.github.io/<repo>` が
 * リポジトリ参照のスラッグとして読まれ、host ごと書き換わります。オーナーだけを変えて
 * リポジトリ名を据え置いてテンプレートから作った場合（`currentName` と書き換え先の名前が同じ）で
 * 必ず踏みます。
 *
 * @param relativePath - 対象ファイルのリポジトリルート相対パス
 * @param original - 対象ファイルの本文
 * @param currentName - 現在のプロジェクト名（`package.json` の `name`）
 * @param repository - `<owner>/<repo>` 形式の書き換え先
 * @param portalUrl - 差し込む portal の URL（正規化済みであること）
 * @returns 書き換えた結果。本文が変わらないなら `null`
 * @throws マーカーの対応が取れていない場合。
 */
export function planReplacement(
  relativePath: string,
  original: string,
  currentName: string,
  repository: string,
  portalUrl: string,
): PlannedReplacement | null {
  const reference = applyRepositoryReference(original, currentName, repository);
  const portal = applyPortalUrl(relativePath, reference.content, portalUrl);

  if (portal.content === original) {
    return null;
  }

  return {
    content: portal.content,
    occurrences: reference.occurrences + portal.changes,
  };
}

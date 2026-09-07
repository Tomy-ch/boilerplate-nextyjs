// リポジトリ参照とプロジェクト名の書き換え。走査とファイル入出力は index.ts が持ち、
// ここは「本文を渡すと書き換えた本文が返る」判定だけを持つ。

/** 書き換えの結果。`occurrences` は書き換えた箇所の数。 */
export type ReferenceReplacement = {
  content: string;
  occurrences: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// String.replace の置換文字列では $ が後方参照などの特殊記号になるため無害化する
function escapeReplacement(value: string): string {
  return value.replace(/\$/g, "$$$$");
}

// 名前の途中で切らないための境界。`.git` や `.md` のような拡張子は境界として扱う
const NAME_TAIL_BOUNDARY = "(?![A-Za-z0-9_-])";
const NAME_HEAD_BOUNDARY = "(?<![A-Za-z0-9._-])";

// <owner>/<現プロジェクト名> 形式のリポジトリ参照。owner 部分もテンプレートから作った側へ差し替える
function buildSlugPattern(currentName: string): RegExp {
  return new RegExp(
    `${NAME_HEAD_BOUNDARY}[A-Za-z0-9._-]+/${escapeRegExp(currentName)}${NAME_TAIL_BOUNDARY}`,
    "g",
  );
}

// 単独で現れるプロジェクト名。package.json の name もここで置換される
function buildNamePattern(currentName: string): RegExp {
  return new RegExp(`${NAME_HEAD_BOUNDARY}${escapeRegExp(currentName)}${NAME_TAIL_BOUNDARY}`, "g");
}

/**
 * リポジトリ参照とプロジェクト名を、テンプレートから作った側のものへ書き換える。
 *
 * @remarks
 * `<owner>/<現プロジェクト名>` 形式のスラッグを先に潰してから、残った単独の名前を書き換えます。
 * 数え上げもこの順で行います —— 先に数えると `<owner>/<name>` を両方のパターンで二重に数えます。
 *
 * @param content - 対象ファイルの本文
 * @param currentName - 現在のプロジェクト名（`package.json` の `name`）
 * @param repository - `<owner>/<repo>` 形式の書き換え先
 */
export function applyRepositoryReference(
  content: string,
  currentName: string,
  repository: string,
): ReferenceReplacement {
  const newName = repository.split("/")[1];
  const slugPattern = buildSlugPattern(currentName);
  const namePattern = buildNamePattern(currentName);

  const afterSlug = content.replace(slugPattern, escapeReplacement(repository));
  const occurrences =
    (content.match(slugPattern)?.length ?? 0) + (afterSlug.match(namePattern)?.length ?? 0);

  return {
    content: afterSlug.replace(namePattern, escapeReplacement(newName)),
    occurrences,
  };
}

// portal の URL の差し替え。既定値の組み立てと、マーカーで囲んだ 2 本のリンクの切り替えを持つ。
//
// リポジトリ参照の置換と同じ道具に乗せてあるのは、入力が同じ <owner>/<repo> だからである。
// 別のターゲットに分けると、テンプレートから作った側は同じ値を 2 回渡すことになり、片方だけ忘れた木が作れてしまう。

import { type StripResult, stripMarkers } from "../lib/markers.js";

/**
 * マーカーの名前。`portal:replace-begin` / `replace-with` / `replace-end` を作る。
 *
 * @remarks
 * 既存のマーカー族に相乗りさせず、独立した族にします。理由は
 * [0141](../../../docs/adr/0141-portal-operations.md) が持ちます。
 */
const PORTAL_MARKER = "portal";

/**
 * 差し替え側に書く、portal の URL の置き場。置換で実 URL に変わる。
 *
 * @remarks
 * **この語を退避コメント以外の場所へ書かないこと。** 差し込みは本文全体を対象にする単純な
 * 文字列置換で、マーカーの内側かどうかを見ません（{@link applyPortalUrl}）。走査対象の
 * 散文（`docs/` の外の README など）にこの語が現れると、黙って URL へ化けます。
 */
const PORTAL_URL_PLACEHOLDER = "__PORTAL_URL__";

/**
 * GitHub Pages の配信先を組み立てる。
 *
 * @remarks
 * project site は `https://<owner>.github.io/<repo>/`、リポジトリ名が `<owner>.github.io` の
 * ときだけ user / organization site になり `<repo>` の段が無くなります。host は大文字小文字を
 * 区別しないので owner は小文字へ寄せますが、path 段になる名前はそのまま使います。
 *
 * portal の実体は `/portal/` にありますが、指すのはサイトルートです。ルートは portal への
 * 転送だけを持つ層で（[0141](../../../docs/adr/0141-portal-operations.md)）、後から並ぶ生成物の
 * ために転送先が動いても、こちらの URL は追随します。
 *
 * @param repository - `<owner>/<repo>` 形式のリポジトリ参照
 */
export function buildDefaultPortalUrl(repository: string): string {
  const [owner, name] = repository.split("/");
  const host = `${owner.toLowerCase()}.github.io`;

  return name.toLowerCase() === host ? `https://${host}/` : `https://${host}/${name}/`;
}

/** 差し替えの結果。`changes` はマーカーで消した行と差し替えた箇所の合計。 */
export type PortalReplacement = {
  content: string;
  changes: number;
};

/**
 * 汎用リンクを portal のリンクへ差し替える。
 *
 * @remarks
 * 2 段で書き換えます。**マーカーの展開**は {@link stripMarkers} が行い、囲まれていない行には
 * 触れません —— boilerplate の木は汎用リンク（有効側）を持ち、通した木は退避側のリンクを
 * 持ちます。続く**プレースホルダの差し込み**は本文全体に掛かり、マーカーの内外を区別しません
 * （{@link PORTAL_URL_PLACEHOLDER}）。
 *
 * `portalUrl` はそのまま埋め込みます。差し込み先は文字列リテラルの中なので、閉じ引用符を
 * 含む値は入口で潰しておくこと（`normalizePortalUrl`）。
 *
 * ファイルを名指しで受け取るのは、マーカーの対応が崩れたときに**どのファイルか**を言うため。
 * 走査は数百ファイルに及ぶので、崩れた形だけを告げても探す手掛かりになりません。
 *
 * @param relativePath - 対象ファイルのリポジトリルート相対パス
 * @param content - 対象ファイルの本文
 * @param portalUrl - 差し込む portal の URL（正規化済みであること）
 * @throws マーカーの対応が取れていない場合。
 */
export function applyPortalUrl(
  relativePath: string,
  content: string,
  portalUrl: string,
): PortalReplacement {
  let stripped: StripResult;

  try {
    stripped = stripMarkers(content, PORTAL_MARKER);
  } catch (error) {
    throw new Error(`${relativePath}: ${(error as Error).message}`);
  }

  const segments = stripped.content.split(PORTAL_URL_PLACEHOLDER);

  return {
    content: segments.join(portalUrl),
    changes: stripped.removed + segments.length - 1,
  };
}

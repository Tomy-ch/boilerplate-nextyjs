/**
 * SonarCloud へ問い合わせる口の綴り。
 *
 * @remarks
 * **問い合わせの値は必ず符号化して載せます。** project key も解析の id も外から届く綴りで、
 * `&` や `#` を含めば、繋いだだけの URL では別の引数として読まれます。
 *
 * 待ち受け先は `report-task.txt` が名乗ったものをそのまま使い、ここでは組み立てません。
 * 綴りを書き写すと、自前で建てた SonarQube を相手にしたときにここだけが別の宛先を指します。
 */

/** 1 度に取る所見の上限。SonarCloud が 1 回の応答で返せる件数の上限でもある。 */
const ISSUE_PAGE_SIZE = "500";

/**
 * 待ち受け先へ path を継ぐ。
 *
 * @remarks
 * 末尾の `/` を落としてから継ぐのは、`report-task.txt` が持つ綴りに `/` が付いていても
 * 同じ URL になるようにするためです。`new URL(path, base)` で組まないのは、先頭が `/` の path が
 * **base の持つ path を丸ごと捨てる**ためで、下位パスに置かれた SonarQube では宛先が変わります。
 */
function endpoint(serverUrl: string, path: string): URL {
  const base = serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl;

  return new URL(`${base}${path}`);
}

/** 積んだ解析の entry。 */
export function ceTaskUrl(serverUrl: string, ceTaskId: string): string {
  const url = endpoint(serverUrl, "/api/ce/task");

  url.searchParams.set("id", ceTaskId);

  return url.toString();
}

/**
 * 品質ゲートの判定。
 *
 * @remarks
 * **project ではなく解析を名指しで問います。** project で問うと、同時に走った別の実行の解析が
 * 答えになりえます。
 */
export function qualityGateUrl(serverUrl: string, analysisId: string): string {
  const url = endpoint(serverUrl, "/api/qualitygates/project_status");

  url.searchParams.set("analysisId", analysisId);

  return url.toString();
}

/**
 * 未解決の所見。
 *
 * @remarks
 * **PR の解析は branch ではなく PR に紐づいて保存されます。** 走査が置いたのと同じ絞りで
 * 問わないと、所見があっても 0 件が返ります。
 *
 * @param pullRequest - PR 番号。branch の解析なら空か `undefined`
 */
export function issuesSearchUrl(
  serverUrl: string,
  projectKey: string,
  pullRequest: string | undefined,
): string {
  const url = endpoint(serverUrl, "/api/issues/search");

  url.searchParams.set("componentKeys", projectKey);
  url.searchParams.set("resolved", "false");
  url.searchParams.set("ps", ISSUE_PAGE_SIZE);

  if (pullRequest !== undefined && pullRequest !== "") {
    url.searchParams.set("pullRequest", pullRequest);
  }

  return url.toString();
}

/**
 * 走査が積んだ解析の在り処を、scanner が残す `report-task.txt` から読む。
 *
 * @remarks
 * 走査そのものは解析を queue へ積むだけで、その場では何も返しません。**後段が結果を読み戻す
 * 手掛かりはこのファイルしかない**ため、ここが読めた鍵だけが以降の工程の入力になります。
 */

/** GitHub Actions の出力へ渡す 1 件。 */
export type TaskEntry = {
  readonly key: string;
  readonly value: string;
};

/**
 * 後段が使う鍵。
 *
 * @remarks
 * ファイルには他の鍵も並びますが、出力へ写すのはここに挙げたものだけです。全部を写すと、
 * scanner が鍵を増やしたときに使いもしない値が job の出力へ現れます。
 */
const REPORTED_KEYS: ReadonlySet<string> = new Set([
  "ceTaskId",
  "serverUrl",
  "projectKey",
  "dashboardUrl",
]);

/**
 * `key=value` の羅列から、後段が使う値を拾う。
 *
 * @remarks
 * **区切りは最初の `=` だけです。** 値そのものが `=` を含む（URL がそうなる）ため、全部の `=` で
 * 割ると値が途中で切れます。
 *
 * @param text - `report-task.txt` の中身
 * @returns 出力へ写す順に並んだ組。ファイルに現れた順を保つ
 */
export function parseTaskReport(text: string): TaskEntry[] {
  const entries: TaskEntry[] = [];

  for (const line of text.split("\n")) {
    const at = line.indexOf("=");

    if (at < 0) {
      continue;
    }

    const key = line.slice(0, at);

    if (!REPORTED_KEYS.has(key)) {
      continue;
    }

    entries.push({ key, value: line.slice(at + 1) });
  }

  return entries;
}

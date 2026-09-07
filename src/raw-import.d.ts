/**
 * バンドラの生読み込み（`?raw`）で得られるモジュールの宣言。
 *
 * @remarks
 * ファイルの中身を文面として確かめるテストが使います。`import.meta.url` から辿る形は、
 * ブラウザを模した環境では文書の URL になって `file:` で解決できません。
 */
declare module "*?raw" {
  const content: string;
  export default content;
}

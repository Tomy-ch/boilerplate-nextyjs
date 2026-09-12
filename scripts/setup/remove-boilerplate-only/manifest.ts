// 剥がす対象の宣言。ここはデータだけを持ち、剥がし方は index.ts が担う。

/**
 * マーカーの名前。`boilerplate-only:begin` / `:end` / `:line` / `:replace-*` を作る。
 *
 * @remarks
 * `sample` 族と同じ名前にはできません。族を分ける理由は [README](../../README.md) から辿ります。
 */
export const BOILERPLATE_ONLY_MARKER = "boilerplate-only";

/**
 * 剥がし終えたあとに自分を消す対象（リポジトリルート相対）。
 *
 * @remarks
 * ファイルやディレクトリごと消すものはマーカーを持てない（消える側に印を書くことになる）ので、
 * ここで宣言します。サンプル破棄（`scripts/setup/remove-sample/`）へ相乗りさせず、**独立に**
 * 消える必要があります。
 *
 * 剥がしを検証する CI（`.github/workflows/strip-verify.yaml`）も対象です。検証する相手が消えた
 * あとに残すと、テンプレートから作った側のすべての PR で「道具が無い」失敗を出し続けます。
 *
 * 共有機構（`scripts/setup/lib/markers.ts`）は消しません。あちらはサンプル破棄も使い、破棄は
 * この後に走りうるからです。
 */
export const SELF_DESTRUCT_PATHS: readonly string[] = [
  "scripts/setup/remove-boilerplate-only",
  // 剥がしそのものを検証する CI。理由は冒頭の @remarks が持つ。
  ".github/workflows/strip-verify.yaml",
  // 上流でしか成り立たない記述を 1 本に集めた文書。残る側にはその指し先しか置かず、指し先は
  // 行ごと消えるので、本体はここで消す以外に消える道が無い。
  "docs/get-started/boilerplate-only-conventions.md",
  // マーカー行数のベースライン。守っているのはマーカーを**書く側**で、書く場面は上流にしかない。
  // 剥がしが済んだツリーにはもう見張る対象が居らず、残せば永久に緑のままの検査が増えるだけになる。
  // サンプル破棄（`scripts/setup/remove-sample`）は、これが先に走った場合に備えて、引き直しを
  // 存在の確認で囲んである。
  "scripts/marker-baseline",
  // 純化パスの台帳と照会フック。答えている問い（どのファイルが純化を通ったか）は、配る側にしか
  // 開いていない —— テンプレートから作った側が受け取るのは通り終えたツリーである。
  // `.claude/settings.json` のフック定義は JSON なので同じ手が使えないが、スクリプトの不在を
  // 確かめてから呼ぶ形にしてあり、残っても何もしない。
  ".agents/purity-sweep",
  // この状態を生んだ計画であって、状態そのものではない。[0140](../../../docs/adr/0140-documentation-operations.md)
  // は v1.0.0 で削除すると決めており、それより前に複製された木へ渡す理由も無い。
  "docs/plan",
  // 上の計画の PR 1 行を issue 1 件へ写すための雛形。計画が消えれば指す先が無い。
  ".github/ISSUE_TEMPLATE/implementation_task.yaml",
];

/**
 * 走査から外すディレクトリ名。
 *
 * @remarks
 * 依存の取得物と VCS の内部、および生成物です。除去しても再生成で戻るものへ書き込むと、次の
 * 生成で消えるうえ drift ゲートが落ちます。
 */
export const EXCLUDED_DIRECTORIES: Set<string> = new Set([
  ".git",
  "node_modules",
  ".next",
  "coverage",
  "coverage-scripts",
  "dist",
  "storybook-static",
  "tmp",
]);

/**
 * 走査から外す相対パス接頭辞。マーカーの形をデータとして持つ区画。
 *
 * @remarks
 * マーカー行のベースライン（`scripts/marker-baseline/`）は、判定とテストがマーカーの形を**入力**
 * として持ちます。剥がしの対象にすると、そこに書かれた例示が消えます。区画自体はこの直後に
 * `SELF_DESTRUCT_PATHS` が消すので跡は残りませんが、**対応の取れない例示がひとつでも増えれば、
 * その時点で剥がしそのものが止まります。**読まないと決めておけば、どちらも起きません。
 */
export const EXCLUDED_PATH_PREFIXES: readonly string[] = ["scripts/marker-baseline/"];

/** マーカーを持てないファイルの拡張子。 */
export const BINARY_EXTENSIONS: readonly string[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".pdf",
  ".zip",
];

/** action pin のロックファイル（リポジトリルート相対）。 */
export const ACTIONS_PIN_LOCK_FILE = ".github/actions-pin.toml";

/** 許可する外向きの宛先の宣言。剥がしで参照が消える塊をここから落とす。 */
export const EGRESS_DECLARATION_FILE = ".github/egress.yaml";

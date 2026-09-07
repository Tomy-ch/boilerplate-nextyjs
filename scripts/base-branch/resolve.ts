// 最新のリリースラインを選ぶ判定。git の呼び出しは入口([index.ts](index.ts))が持ち、ここは
// 受け取った `git ls-remote --heads` の出力だけから答えを出す。

import { selectLatestVersion } from "../semver/latest.js";

/** リリースラインのブランチ名の接頭辞。 */
const RELEASE_LINE_PREFIX = "release/";

/** `git ls-remote --heads` が返す参照の接頭辞。 */
const HEADS_PREFIX = "refs/heads/";

/**
 * リリースラインが 1 本も無いときに出す行。
 *
 * @remarks
 * 取得は成功しても 0 件になり得ます(remote にまだ無い、参照の書式が変わった)。空文字を
 * 返すと、呼び出し側は解決できなかったことに気付かないまま空のベースで進みます。
 */
export const NO_RELEASE_LINE_MESSAGE = "release/vX.Y.Z 形式のブランチが 1 本もありません";

/**
 * 引数を受け取っていれば、案内の 1 行を返す。受け取っていなければ null。
 *
 * @remarks
 * 黙って捨てると、フラグのつもりで渡された指定が無視されたまま、もっともらしいブランチ名が
 * 返ります。
 */
export function unexpectedArguments(argv: readonly string[]): string | null {
  return argv.length === 0 ? null : `使い方: base-branch(引数は取りません): ${argv.join(" ")}`;
}

/**
 * `<sha>\t<ref>` の 1 行から、リリースラインの参照なら版の位置の文字列を取り出す。
 * 版として読めるかはここでは見ない。
 */
function releaseVersionOf(line: string): string | null {
  const [, ref] = line.split("\t");

  if (ref === undefined) {
    return null;
  }

  const name = ref.trim();
  const prefix = `${HEADS_PREFIX}${RELEASE_LINE_PREFIX}`;

  return name.startsWith(prefix) ? name.slice(prefix.length) : null;
}

/**
 * `git ls-remote --heads` の出力から、最新のリリースラインのブランチ名を選ぶ。
 *
 * @remarks
 * 「最新」は版の数値比較で、判定は [latest.ts](../semver/latest.ts) と共有します。
 * リリースラインの書式(`release/vX.Y.Z`)に合わない参照は数えません。
 * 何をこの出力の出所にするか、なぜ日時や文字列順で選ばないかは [README](README.md) にあります。
 *
 * @param lsRemoteOutput - `git ls-remote --heads <remote> 'refs/heads/release/*'` の出力
 * @returns 最新のリリースラインのブランチ名
 * @throws 解釈できる行が 1 つも無いとき
 */
export function selectLatestReleaseLine(lsRemoteOutput: string): string {
  const versions = lsRemoteOutput.split("\n").flatMap((line) => {
    const version = releaseVersionOf(line);

    return version === null ? [] : [version];
  });
  const latest = selectLatestVersion(versions);

  if (latest === null) {
    throw new Error(NO_RELEASE_LINE_MESSAGE);
  }

  return `${RELEASE_LINE_PREFIX}${latest}`;
}

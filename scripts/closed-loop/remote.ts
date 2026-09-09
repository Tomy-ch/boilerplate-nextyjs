// GitHub の綴りから答えを読む判定。読み取りと遣り取りは入口が持ち、ここは受け取った文字列
// だけから答えを出す —— `.git` の remote からの送出先と、`gh` が返した URL からの issue 番号。
//
// **送出先を設定で持たない。**このリポジトリが押している先そのものへ送るのが、
// [0160](../../docs/adr/0160-agent-environment-loop.md) 決定 4 の「所見は issue トラッカーへ」
// が指す唯一の宛先である。別の設定項目で宛先を持つと、**リポジトリと無関係な先へ送れる形**が
// 生まれ、境界の議論がその項目の値に移ってしまう。

/**
 * remote の URL から `owner/repo` を導く。
 *
 * @remarks
 * git が持つ綴りは 1 つではありません —— `https://`、`ssh://`、`git@host:owner/repo` の
 * 3 つを読みます。**GitHub 以外のホストは送出先にしません**。宛先が `.git` に在ることは、
 * それが GitHub であることを意味しないためで、判断できないものを既定へ倒すと
 * 「送ったつもりで届いていない」か「知らない先へ送る」のどちらかになります。
 */
export function toRepoSlug(url: string): string | null {
  const trimmed = url.trim();

  if (trimmed === "") {
    return null;
  }

  const scp = /^[^@/]+@([^:]+):(.+)$/.exec(trimmed);
  const host = scp?.[1] ?? hostOf(trimmed);
  const rawPath = scp?.[2] ?? pathOf(trimmed);

  if (host === null || rawPath === null || !isGitHub(host)) {
    return null;
  }

  const segments = rawPath
    .replace(/\.git$/, "")
    .split("/")
    .filter((segment) => segment !== "");

  if (segments.length !== 2) {
    return null;
  }

  return segments.join("/");
}

/** GitHub のホストか。企業向けの `github.<会社>.com` は別物なので通さない。 */
function isGitHub(host: string): boolean {
  return host.toLowerCase() === "github.com";
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function pathOf(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/**
 * `gh issue create` が返した URL から issue 番号を読む。
 *
 * @remarks
 * 読めなければ**例外で止めます**。投稿は成っているので、番号を落として先へ進むと
 * 「立ったが索引に無い」窓が残り、次の週次が同じ窓をもう一度立てます。止まれば人が見て、
 * 二度立っても題で気づけます。
 *
 * @param url - `gh` が標準出力へ返した issue の URL
 * @returns issue 番号
 * @throws 末尾が数として読めないとき
 */
export function issueNumberFrom(url: string): number {
  // `split` は必ず 1 要素以上返すので `at(-1)` の不在は起こり得ない。その形で書くと、
  // 通らない枝を残したまま「網羅した」ことになる。区切りが無ければ全体を読ませて落とす。
  const number = Number.parseInt(url.slice(url.lastIndexOf("/") + 1), 10);

  if (!Number.isFinite(number)) {
    throw new TypeError(`URL から issue の番号を読めない: ${url}`);
  }

  return number;
}

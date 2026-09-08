// 送出先を `.git` の remote から導く判定。読み取りは入口が持ち、ここは受け取った URL から
// 送出先を決める。
//
// **送出先を設定で持たない。**このリポジトリが押している先そのものへ送るのが、
// [0160](../../docs/adr/0160-agent-environment-loop.md) 決定 4 の「所見は issue トラッカーへ」
// が指す唯一の宛先である。別の設定項目で宛先を持つと、**リポジトリと無関係な先へ送れる形**が
// 生まれ、境界の議論がその項目の値に移ってしまう。

/** 送出先。`owner/repo` の形。 */
export type RepoSlug = string;

/**
 * remote の URL から `owner/repo` を導く。
 *
 * @remarks
 * git が持つ綴りは 1 つではありません —— `https://`、`ssh://`、`git@host:owner/repo` の
 * 3 つを読みます。**GitHub 以外のホストは送出先にしません**。宛先が `.git` に在ることは、
 * それが GitHub であることを意味しないためで、判断できないものを既定へ倒すと
 * 「送ったつもりで届いていない」か「知らない先へ送る」のどちらかになります。
 */
export function toRepoSlug(url: string): RepoSlug | null {
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

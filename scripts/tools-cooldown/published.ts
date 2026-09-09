// pin が指す版の公開日時を、backend の配布経路から引く。ネットワークへの遣り取りは注入された
// `fetchJson` が担い、ここは URL の組み立てと応答の読み方だけを持つ。

/**
 * 窓を当てる配布経路の種別。窓はこの単位で決まる —— 悪意ある版が公開されてから撤回されるまでの
 * 時間は、ツールが何を壊しうるかではなく、どの経路で配られたかに比例する。
 */
export type Channel = "github-release" | "registry";

/**
 * backend の扱い。
 *
 * - `channel` — 窓を当てる配布経路を持つ
 * - `excluded` — 言語ランタイム（`core:`）。窓の対象外と決めたもので、棚卸しには載せる
 * - `none` — 公開日時を引く経路を持たない。検査できない
 *
 * `excluded` と `none` を分けて持つのは出口が違うため。前者は検査しないと決めたもの、後者は
 * 検査が成立していないもので、落ちるのは後者だけ。
 */
export type Route =
  | { readonly kind: "channel"; readonly channel: Channel }
  | { readonly kind: "excluded" }
  | { readonly kind: "none" };

/** JSON を返す HTTP GET。応答の解釈は呼ぶ側が持つ。 */
export type FetchJson = (url: string) => Promise<{
  readonly status: number;
  readonly body: unknown;
}>;

/** 公開日時を引く対象。 */
export type PinRef = {
  readonly key: string;
  readonly version: string;
};

const GITHUB_API = "https://api.github.com/repos/";
const NPM_REGISTRY = "https://registry.npmjs.org/";
const PYPI = "https://pypi.org/pypi/";

/**
 * backend から扱いを決める。
 *
 * @remarks
 * `aqua:` / `ubi:` / `github:` は GitHub Releases、`npm:` / `pipx:` / `pypi:` は公開レジストリ。
 * `core:` は言語ランタイムで、その配布物の汚染は 1 リンクの乗っ取りではなく言語の信頼モデルの
 * 失敗なので、窓を置いても検知が回ってくる保証が無い —— 受容するリスクとして窓の対象から外す
 * （[README](./README.md)）。**それ以外は `none`** —— 公開日時を引く経路を持たない backend は
 * 「検査できなかった」として呼ぶ側が落とす。
 *
 * @param key - `mise.toml` のキー（backend 付き）
 */
export function routeOf(key: string): Route {
  if (!key.includes(":")) return { kind: "none" };

  const [backend] = key.split(":", 1);

  switch (backend) {
    case "aqua":
    case "ubi":
    case "github":
      return { kind: "channel", channel: "github-release" };
    case "npm":
    case "pipx":
    case "pypi":
      return { kind: "channel", channel: "registry" };
    case "core":
      return { kind: "excluded" };
    default:
      return { kind: "none" };
  }
}

/** backend の接頭辞と、`[...]` の付加指定を落とした名前。 */
function nameOf(key: string): string {
  const [, ...rest] = key.split(":");

  const name = rest.join(":");
  const optionAt = name.indexOf("[");

  return optionAt < 0 ? name : name.slice(0, optionAt);
}

/** 応答の値を日時として読む。読めなければ落とす —— ゼロ値は「公開から数十年」と読まれる。 */
function asDate(value: unknown, what: string): Date {
  const at = typeof value === "string" ? new Date(value) : new Date(Number.NaN);

  if (Number.isNaN(at.getTime())) {
    throw new TypeError(`${what} を日時として読めません`);
  }

  return at;
}

/** GitHub Releases。tag に `v` を付ける流儀と付けない流儀があるので、両方を試す。 */
async function githubReleaseAt(pin: PinRef, fetchJson: FetchJson): Promise<Date> {
  const repo = nameOf(pin.key);

  for (const tag of [`v${pin.version}`, pin.version]) {
    const response = await fetchJson(`${GITHUB_API}${repo}/releases/tags/${tag}`);

    if (response.status === 200) {
      const body = response.body as { published_at?: unknown };

      return asDate(body.published_at, `${repo} の release ${tag} の published_at`);
    }

    if (response.status !== 404) {
      throw new Error(`${repo} の release ${tag} の取得に失敗しました（HTTP ${response.status}）`);
    }
  }

  throw new Error(`${repo} に release v${pin.version} / ${pin.version} がありません`);
}

/** npm registry。`time` に版ごとの公開日時が並ぶ。 */
async function npmAt(pin: PinRef, fetchJson: FetchJson): Promise<Date> {
  const name = nameOf(pin.key);
  const response = await fetchJson(`${NPM_REGISTRY}${name}`);

  if (response.status !== 200) {
    throw new Error(`${name} の取得に失敗しました（HTTP ${response.status}）`);
  }

  const body = response.body as { time?: Record<string, unknown> };

  return asDate(body.time?.[pin.version], `${name}@${pin.version} の time`);
}

/**
 * PyPI。版ごとの配布物（wheel / sdist）に upload 時刻が付く。**最も早いものを採る** —— 検疫が
 * 問うのは「この版はいつから存在するか」で、後から足された配布物の時刻ではない。
 */
async function pypiAt(pin: PinRef, fetchJson: FetchJson): Promise<Date> {
  const name = nameOf(pin.key);
  const response = await fetchJson(`${PYPI}${name}/${pin.version}/json`);

  if (response.status !== 200) {
    throw new Error(`${name}@${pin.version} の取得に失敗しました（HTTP ${response.status}）`);
  }

  const body = response.body as { urls?: { upload_time_iso_8601?: unknown }[] };
  const times = (body.urls ?? []).map((file) =>
    asDate(file.upload_time_iso_8601, `${name}@${pin.version} の upload_time_iso_8601`),
  );

  if (times.length === 0) {
    throw new Error(`${name}@${pin.version} に配布物がありません`);
  }

  return new Date(Math.min(...times.map((time) => time.getTime())));
}

/**
 * pin が指す版の公開日時。窓を当てる経路を持つ pin にだけ意味を持つ。
 *
 * @param pin - backend 付きのキーと版
 * @param fetchJson - JSON を返す HTTP GET
 * @throws 窓の対象外の backend、経路を持たない backend、上流にその版が無いとき、応答を読めないとき
 */
export async function publishedAt(pin: PinRef, fetchJson: FetchJson): Promise<Date> {
  const route = routeOf(pin.key);

  switch (route.kind) {
    case "channel":
      if (route.channel === "github-release") return githubReleaseAt(pin, fetchJson);

      return pin.key.startsWith("npm:") ? npmAt(pin, fetchJson) : pypiAt(pin, fetchJson);
    case "excluded":
      throw new Error(`${pin.key} は窓の対象外で、公開日時を引きません`);
    default:
      throw new Error(`${pin.key} の backend は公開日時を引く経路を持ちません`);
  }
}

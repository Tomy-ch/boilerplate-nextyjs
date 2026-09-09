// 基準画像の置き場を用意するときの判定。GitHub への問い合わせと対話は index.ts が持ち、
// ここは受け取った値だけで決まることを担う。

/**
 * 置き場の既定名を作る接尾辞。
 *
 * @remarks
 * テンプレートから作った側の名前置換に追随するよう、親の名前から導きます。
 *
 * `images` まで含めるのは、**`.gitmodules` で置き場のパスと URL が隣り合わせに並ぶ**ためです。
 * 配線先は `baseline/images` なので、名前を揃えると 2 行が同じものを指していると読めます。
 */
const NAME_SUFFIX = "-baseline-images";

/**
 * 書き込みができる権限。
 *
 * @remarks
 * 足りない権限で進むと、置き場を作った後に push だけが失敗して原因が遠くなります。ここは
 * **許可する側を列挙**します。GitHub が権限を増やしたとき、既定で「書ける」側へ倒れないためです。
 */
export const WRITABLE_PERMISSIONS: readonly string[] = ["ADMIN", "MAINTAIN", "WRITE"];

/** 指定できる公開範囲。`internal` は組織のみ有効だが、可否は GitHub 側が判定する。 */
export const VISIBILITIES: readonly string[] = ["public", "private", "internal"];

/**
 * 公開範囲の既定。
 *
 * @remarks
 * 基準画像は画面の見た目そのものなので、公開側へ倒れる既定は取れません。親に合わせると、
 * 公開のテンプレートから作った非公開プロジェクトが黙って画面を公開します。
 *
 * 代償として、**置き場が非公開だと fork からの PR で `vrt` が落ちます**。fork の PR には
 * secrets が渡らず、App のトークンを取れないためです。公開のまま運用するリポジトリは、
 * ここで `public` を選んでください。
 */
export const DEFAULT_VISIBILITY = "private";

/** `owner/repo` を owner と repo に割る。 */
export function splitRepository(repository: string): { owner: string; name: string } {
  const [, owner, name] = /^([^/\s]+)\/([^/\s]+)$/.exec(repository) ?? [];
  if (owner === undefined || name === undefined) {
    throw new Error(`owner/repo の形ではありません: ${JSON.stringify(repository)}`);
  }
  return { owner, name };
}

/** 親リポジトリから導く置き場の既定名。 */
export function defaultImagesName(parentRepository: string): string {
  return `${splitRepository(parentRepository).name}${NAME_SUFFIX}`;
}

/** 置き場は親と同じ owner の下に作る。名前だけを受け取り、`owner/repo` に組み立てる。 */
export function targetRepository(parentRepository: string, name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new Error("リポジトリ名が空です。");
  }
  if (trimmed.includes("/")) {
    throw new Error(
      `リポジトリ名に owner は含めません: ${JSON.stringify(trimmed)}（既存を使う場合は最初の問いへ入力してください）`,
    );
  }
  return `${splitRepository(parentRepository).owner}/${trimmed}`;
}

/** 既存の置き場を使えるか。使えないときは、何が足りないかを載せて投げる。 */
export function assertWritable(repository: string, permission: string): void {
  if (!WRITABLE_PERMISSIONS.includes(permission)) {
    throw new Error(
      `${repository} への書き込み権限がありません（現在: ${permission || "不明"}）。`,
    );
  }
}

/** `gh` が返す大文字の公開範囲も受けて、`gh repo create` へ渡せる形へ揃える。 */
export function normalizeVisibility(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!VISIBILITIES.includes(normalized)) {
    throw new Error(
      `公開範囲は ${VISIBILITIES.join(" / ")} のいずれかです（入力: ${JSON.stringify(value)}）。`,
    );
  }
  return normalized;
}

/**
 * サブモジュールへ書く URL。
 *
 * @remarks
 * HTTPS を使うのは、CI とテンプレートから作った側が鍵の配置なしに読めるためです。撮り直しの push は
 * GitHub App のトークンを `http.extraheader` へ載せて通します。
 */
export function cloneUrl(repository: string): string {
  return `https://github.com/${repository}.git`;
}

/**
 * 置き場へ置く README を組み立てる。
 *
 * @remarks
 * 差し込み漏れがあれば投げます。埋まらないまま push すると、置き場の README に `{{...}}` が
 * 残ったまま誰も直しません。
 */
export function renderReadme(
  template: string,
  values: { repositoryName: string; parentRepository: string },
): string {
  const rendered = template
    .replaceAll("{{REPO_NAME}}", values.repositoryName)
    .replaceAll("{{PARENT_REPO}}", values.parentRepository);

  const leftover = /\{\{[^{}]+\}\}/.exec(rendered);
  if (leftover !== null) {
    throw new Error(`README のテンプレートに差し込めない箇所があります: ${leftover[0]}`);
  }
  return rendered;
}

/**
 * 端末へ入力された `.pem` のパスを実際のパスへ均す。
 *
 * @remarks
 * 端末へファイルをドラッグすると、空白を `\ ` で逃がした形や引用符で囲まれた形が入ります。
 * `~` も展開します（シェルではなくこのプロセスが受け取るので、そのままでは開けません）。
 */
export function normalizeKeyPath(input: string, homeDirectory: string): string {
  const unquoted = input.trim().replace(/^(['"])(.*)\1$/, "$2");
  const unescaped = unquoted.replace(/\\(.)/g, "$1").trim();

  if (unescaped === "") {
    throw new Error("秘密鍵 (.pem) のパスを入力してください。");
  }
  return unescaped === "~" || unescaped.startsWith("~/")
    ? `${homeDirectory}${unescaped.slice(1)}`
    : unescaped;
}

/**
 * 秘密鍵の中身に見えるか。
 *
 * @remarks
 * パスを取り違えたまま secret を設定すると、失敗するのは数日後の撮り直しです。中身を全部
 * 読まずに先頭だけ見るのは、鍵をこのプロセスの記憶へ載せないためです。
 */
export function looksLikePrivateKey(head: string): boolean {
  return /^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(head.trimStart());
}

/** 空の回答を既定値へ落とす。 */
export function withDefault(answer: string, fallback: string): string {
  const trimmed = answer.trim();
  return trimmed === "" ? fallback : trimmed;
}

/** 確認の回答。既定は「進めない」側に置く。 */
export function isAffirmative(answer: string): boolean {
  return ["y", "yes"].includes(answer.trim().toLowerCase());
}

/**
 * App ID を取り出す。ラベルごと貼り付けられても拾う。
 *
 * @remarks
 * slug から引かないのは、`GET /apps/{slug}` が**公開されている App しか返さない**ためです。
 * この App は installation を 2 リポジトリに絞る前提で非公開に作るので、その経路は必ず 404 に
 * なります。ID を引ける他の API はいずれも App 自身の鍵で署名した JWT を要求するため、
 * 鍵を登録する前の時点では使えません。
 *
 * 番号は App の General ページに出ているので、控える手間は URL を控えるのと変わりません。
 */
export function parseAppId(input: string): string {
  const appId = /^(?:App ID[:：]?\s*)?(\d+)$/.exec(input.trim())?.[1];

  if (appId === undefined) {
    throw new Error(
      `App ID（General ページに出ている数字）を入力してください（受け取った値: ${JSON.stringify(input)}）`,
    );
  }
  return appId;
}

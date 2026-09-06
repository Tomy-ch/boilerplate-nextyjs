import path from "node:path";
import { config } from "dotenv";

/** `APP_ENV` が選べる環境。 */
export type ApplicationEnvironment = "local" | "ci" | "dev" | "stg" | "prd";

const applicationEnvironments: readonly ApplicationEnvironment[] = [
  "local",
  "ci",
  "dev",
  "stg",
  "prd",
];

let isLoaded = false;

function isApplicationEnvironment(value: string): value is ApplicationEnvironment {
  return applicationEnvironments.some((environment) => environment === value);
}

/**
 * `APP_ENV` に指定された環境を返す。指定が無ければ null。
 *
 * @remarks
 * **既定値へ落としません。** 環境を条件にして開発専用の口を閉じる判断も、同梱の秘密値を許す
 * 判断も、「未設定」を安全側へ倒せなければ意味を失います。既定値を返すと、`APP_ENV` を設定し
 * 忘れた実環境が `local` として扱われ、閉じたはずの口が開きます。
 *
 * @throws `APP_ENV` が選べる値でないとき
 */
export function findApplicationEnvironment(): ApplicationEnvironment | null {
  const applicationEnvironment = process.env["APP_ENV"];

  if (applicationEnvironment === undefined) {
    return null;
  }

  if (!isApplicationEnvironment(applicationEnvironment)) {
    throw new Error(
      `APP_ENV は ${applicationEnvironments.join(", ")} のいずれかを指定してください: ${applicationEnvironment}`,
    );
  }

  return applicationEnvironment;
}

/**
 * 開発専用の口を開ける環境。
 *
 * @remarks
 * ここに `dev` / `stg` / `prd` を足すと、**誰でも任意の役割の session を発行できる口**が実環境に
 * 開きます。判定を API の接続モードではなく環境そのものに置いているのは、接続モードが
 * 「mock を実環境に置かない」という散文の約束でしか守られていないためです。
 */
const developmentOnlyEnvironments: ReadonlySet<ApplicationEnvironment> = new Set(["local", "ci"]);

/**
 * 開発専用の口を開けてよい環境か。
 *
 * @remarks
 * **`APP_ENV` が指定されていることも要求します。** 未指定を既定値へ落とすと、設定を忘れた実環境が
 * `local` として扱われ、この種の口が開きます（[0030](../../docs/adr/0030-environment-variable-management.md)）。
 *
 * 判定をここに置くのは、口が増えるたびに同じ条件が写るのを避けるためです。開ける環境の一覧が
 * 2 か所にあると、片方だけを広げた変更が黙って通ります。
 */
export function isDevelopmentOnlyEndpointOpen(): boolean {
  const environment = findApplicationEnvironment();

  return environment !== null && developmentOnlyEnvironments.has(environment);
}

/**
 * `APP_ENV` が示す `env/.env.<環境>` を一度だけ `process.env` へ読み込む。
 *
 * @remarks
 * `override: false` により CI・PaaS が注入した値を常に優先します。
 *
 * **指定を要求します。** 既定を持つと、設定を忘れた実環境が同梱の `env/.env.local` を読み、
 * 注入し忘れた変数だけが手元向けの値で埋まった状態で起動します。開発の入口（`pnpm dev` /
 * `pnpm storybook`）は script が `local` を渡すため、clone 直後はそのまま動きます。
 *
 * @throws `APP_ENV` が未指定のとき / 指す ENV ファイルを読めないとき
 */
export function loadEnvironment(): void {
  if (isLoaded) {
    return;
  }

  const applicationEnvironment = findApplicationEnvironment();

  if (applicationEnvironment === null) {
    throw new Error(
      `APP_ENV を指定してください: ${applicationEnvironments.join(", ")}（例: APP_ENV=local）`,
    );
  }

  const environmentPath = path.join(process.cwd(), "env", `.env.${applicationEnvironment}`);
  const result = config({ path: environmentPath, override: false, quiet: true });
  if (result.error !== undefined) {
    throw new Error(`環境変数ファイルを読み込めません: ${environmentPath}`, {
      cause: result.error,
    });
  }

  isLoaded = true;
}

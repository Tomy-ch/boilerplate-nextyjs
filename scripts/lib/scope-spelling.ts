/**
 * 取得の口が分類を綴りのまま宣言しているかの判定。
 *
 * @remarks
 * 判定だけをここに置き、ツリーの走査は `scripts/scope-spelling.gate.test.ts` が担う。
 */

/** 分類を受け取る口の呼び出し。 */
const CLIENT_FACTORY = /createHttpClient\(/;

/** 検査が読める形の宣言。 */
const SPELLED_SCOPE = /scope:\s*"(?:public|user-scoped)"/;

/** 走査で渡すモジュール。 */
export type ScopeDeclaringModule = {
  /** リポジトリ根からの相対パス。 */
  readonly path: string;
  readonly content: string;
};

/**
 * 口を作りながら分類を綴りで宣言していないモジュールを挙げる。
 *
 * @remarks
 * 口を作らないモジュールは対象外。分類は口の性質なので、口が無ければ宣言する相手も居ない。
 */
export function findUnspelledScopes(
  modules: readonly ScopeDeclaringModule[],
): readonly ScopeDeclaringModule[] {
  return modules.filter(
    ({ content }) => CLIENT_FACTORY.test(content) && !SPELLED_SCOPE.test(content),
  );
}

/** 検出結果を、直せる形の文言へ整える。違反が無ければ空文字。 */
export function formatUnspelledScopes(modules: readonly ScopeDeclaringModule[]): string {
  return modules
    .map(
      ({ path }) =>
        `${path}: 取得の口の分類を \`scope: "public"\` / \`scope: "user-scoped"\` と綴りのまま書いてください。定数へ寄せると project-rules/no-user-scoped-in-cached-module が読めなくなります`,
    )
    .join("\n");
}

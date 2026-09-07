import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { Rule } from "eslint";

/**
 * サーバに保存されるキャッシュを持つモジュールから、user-scoped な取得の口を import させないルール
 * （[0112](../docs/adr/0112-data-classification-cache-boundary.md) 決定 4 の段 2 /
 * `docs/rules.md`「データ分類と機微情報」の「サーバへ保存されるキャッシュから user-scoped な取得の口を
 * 引かない」）。
 *
 * `use cache` は**口の外側からモジュールごと**キャッシュへ入れるため、口の型では止まらない。
 * `use cache: private` はサーバへ保存されないので対象外。
 *
 * **判定は直接の import だけを見る。** 間接参照の深い経路は取りこぼすが、そこは framework の防御
 * (cached scope からの `cookies()` 読み出し) と取得時の関門が覆う。
 *
 * **判定の単位はモジュールであって、import した名前ではない。** 口を作るモジュールが純粋な変換も
 * 一緒に export していると、変換だけを引いた `use cache` も止まる。名前ごとに口へ辿り着くかを
 * 追うには、export から `createHttpClient` までの到達可能性を解く必要があり、この段の役目
 * (キャッシュへ入れる前に止める) に見合わない。**止まったほうを直す** —— 口と一緒に居る変換は、
 * 引く側が増えた時点で自分のモジュールを持つに値する。
 *
 * 分類の宣言そのものを読む。写した一覧を持つと、口の宣言が動いたときに黙って古いままになる。
 * その読み方の帰結として、口を作る kernel（`adapters/server/http/request.ts`）自身も当たる。外さない
 * —— `use cache` の下で client をその場で組む形も、作る先が user-scoped なら同じ事故を作る。
 */
const CACHE_DIRECTIVE_PATTERN = /^use cache(?::\s*([\w-]+))?$/;

/** サーバへ保存しないキャッシュの profile。 */
const CLIENT_ONLY_CACHE_PROFILE = "private";

/** 取得の口が user-scoped を名乗る綴り。 */
const USER_SCOPED_DECLARATION = /scope:\s*"user-scoped"/;

/** import 先の候補になる拡張子。 */
const MODULE_SUFFIXES: readonly string[] = [".ts", ".tsx", "/index.ts", "/index.tsx"];

/** サーバへ保存されるキャッシュの宣言か。 */
function isServerCacheDirective(value: string): boolean {
  const match = CACHE_DIRECTIVE_PATTERN.exec(value);

  return match !== null && match[1] !== CLIENT_ONLY_CACHE_PROFILE;
}

/**
 * import の綴りから、拡張子を除いた実ファイルの位置を組む。組めない綴りは `undefined`。
 *
 * 扱うのは別名（`@/`）と相対だけで、素の package 名はここで落ちる。
 */
function moduleBase(specifier: string, filename: string, cwd: string): string | undefined {
  if (specifier.startsWith("@/")) {
    return join(cwd, "src", specifier.slice("@/".length));
  }

  if (specifier.startsWith(".")) {
    return resolve(dirname(filename), specifier);
  }

  return undefined;
}

/**
 * import の綴りを実ファイルへ解決する。解決できなければ `undefined`。
 *
 * 見るのはこのリポジトリのソースだけである。依存パッケージは取得の口を持たないうえ、解決に
 * `node_modules` の探索が要る。
 */
function resolveModule(specifier: string, filename: string, cwd: string): string | undefined {
  const base = moduleBase(specifier, filename, cwd);

  if (base === undefined) {
    return undefined;
  }

  return MODULE_SUFFIXES.map((suffix) => `${base}${suffix}`).find((candidate) =>
    existsSync(candidate),
  );
}

/** そのモジュールが user-scoped な取得の口を宣言しているか。 */
function declaresUserScopedClient(path: string): boolean {
  return USER_SCOPED_DECLARATION.test(readFileSync(path, "utf8"));
}

const noUserScopedInCachedModule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "サーバに保存されるキャッシュから user-scoped な取得の口を引かない",
    },
    schema: [],
    messages: {
      noUserScopedInCachedModule:
        "`{{specifier}}` は主体に紐づく取得の口を持つモジュールです。`use cache` の下から引くと、ある主体の値が別の主体へ配られます。取得を穴（Suspense の内側）へ落とすか、`use cache: private` を選んでください。口ではなく同居している純粋な変換だけが要るなら、その変換を別のモジュールへ出してください。",
    },
  },
  create(context) {
    const imports: { node: Rule.Node; specifier: string }[] = [];
    let cached = false;

    return {
      Literal(node) {
        if (
          node.parent.type === "ExpressionStatement" &&
          typeof node.value === "string" &&
          isServerCacheDirective(node.value)
        ) {
          cached = true;
        }
      },
      ImportDeclaration(node) {
        imports.push({ node, specifier: String(node.source.value) });
      },
      "Program:exit"() {
        if (!cached) {
          return;
        }

        for (const { node, specifier } of imports) {
          const path = resolveModule(specifier, context.filename, context.cwd);

          if (path !== undefined && declaresUserScopedClient(path)) {
            context.report({ node, messageId: "noUserScopedInCachedModule", data: { specifier } });
          }
        }
      },
    };
  },
};

export default noUserScopedInCachedModule;

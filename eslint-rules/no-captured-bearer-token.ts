import type { Rule, Scope } from "eslint";

/**
 * 資格情報の取得口に、その場で組んだ関数や掴んだ値を渡させないルール。
 *
 * この検査が守る前提は `docs/rules.md`「データ分類と機微情報」の「資格情報は使用地点で
 * `cookies()` から解決する」が持つ。
 *
 * 綴りごとに通す形が違う。
 *
 * | 綴り | 通すもの | 理由 |
 * | --- | --- | --- |
 * | `getBearerToken` | import した口 | 宣言が 1 か所にあり、そこを読めば解決の経路が分かる |
 * | `bearerToken` | 囲む関数の引数 | 確立中の 1 往復は、トークンが呼び出しと一緒に届く |
 *
 * **例外の綴りも見る。** 周囲の adapter は `let client; client ??= createHttpClient(...)` で
 * クライアントをモジュール変数へ固定する形を採っており、その形へ `bearerToken` を持ち込むと、
 * 最初の要求のトークンがプロセスの寿命だけ居座って、以後の全員がその主体として出ていく。引数
 * だけを通すのは、掴んだ値がこの綴りからも入れないようにするためである。
 *
 * テストは対象外にする。取得口の振る舞いを確かめる側であり、束には載らない。
 */
const RESOLVER_PROPERTY = "getBearerToken";

/** 解決済みの資格情報を渡す、確立中だけの綴り。 */
const ESTABLISHING_PROPERTY = "bearerToken";

/** テストか。 */
function isTest(filename: string): boolean {
  return /\.test\.[cm]?[jt]sx?$/.test(filename);
}

/**
 * プロパティが名指している綴り。実行時にしか決まらないキーなら `undefined`。
 *
 * @remarks
 * **リテラルのキーは `[...]` で書かれていても綴りが確定します。** 綴りで一致を取る検査が
 * `["getBearerToken"]` を見逃すと、括弧を足すだけで規則を外せることになります。確定しないのは
 * `[識別子]` のように値が実行時に決まるキーだけです。
 */
function spelledProperty(
  key: { type: string; value?: unknown; name?: string },
  computed: boolean,
): string | undefined {
  if (key.type === "Literal") {
    return typeof key.value === "string" ? key.value : undefined;
  }

  return !computed && key.type === "Identifier" ? key.name : undefined;
}

/**
 * 名前が指す変数を、内側の scope から順に探す。見つからなければ `undefined`。
 *
 * @remarks
 * 参照の解決を scope の連なりで行うのは、渡す口が module の直下で import され、渡す側が関数の
 * 中に居るためである。手前の scope だけを見ると、その全部を取りこぼす。
 */
function findVariable(scope: Scope.Scope | null, name: string): Scope.Variable | undefined {
  for (let current = scope; current !== null; current = current.upper) {
    const found = current.variables.find((variable) => variable.name === name);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

/** その名前が、宣言の種類のいずれかとして束縛されているか。 */
function boundAs(
  scope: Scope.Scope | null,
  name: string,
  definition: "ImportBinding" | "Parameter",
): boolean {
  return findVariable(scope, name)?.defs.some((each) => each.type === definition) === true;
}

const noCapturedBearerToken: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "資格情報は使用地点で解決する口を渡す",
    },
    schema: [],
    messages: {
      noCapturedResolver:
        "`getBearerToken` には import した取得口を渡してください。掴んだ値を返す関数を渡すと `cookies()` が読まれず、cached scope の防御が黙って外れます。確立中の 1 往復は `bearerToken` を使ってください。",
      noCapturedToken:
        "`bearerToken` には、囲む関数がその呼び出しで受け取った引数を渡してください。掴んだ値を渡すと、最初の要求の資格情報がプロセスの寿命だけ居座り、以後の全員がその主体として出ていきます。",
    },
  },
  create(context) {
    return {
      Property(node) {
        // 見るのは値を渡す側だけである。分解代入の同じ綴りは受け取る側で、渡された口をそのまま
        // 束縛しているに過ぎない。
        if (node.parent.type !== "ObjectExpression" || isTest(context.filename)) {
          return;
        }

        const spelled = spelledProperty(node.key, node.computed);
        const value = node.value;

        if (spelled === RESOLVER_PROPERTY) {
          if (
            value.type !== "Identifier" ||
            !boundAs(context.sourceCode.getScope(node), value.name, "ImportBinding")
          ) {
            context.report({ node, messageId: "noCapturedResolver" });
          }

          return;
        }

        if (spelled !== ESTABLISHING_PROPERTY) {
          return;
        }

        if (
          value.type !== "Identifier" ||
          !boundAs(context.sourceCode.getScope(node), value.name, "Parameter")
        ) {
          context.report({ node, messageId: "noCapturedToken" });
        }
      },
    };
  },
};

export default noCapturedBearerToken;

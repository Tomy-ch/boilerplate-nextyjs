import { resolve } from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

import { APP_ELEMENTS, DEPENDENCIES, type Kernel } from "../architecture";

/**
 * `app` の element の禁止が、実際に効いていることを見るゲート。
 *
 * @remarks
 * {@link APP_ELEMENTS} の `forbidden` は **fail-open へ倒れうる列**である。評価の並びが崩れても
 * lint は緑のままで、禁止だけが静かに消える。だから宣言を読むのではなく、**ESLint に実際に
 * 掛けて落ちることを確かめる**。
 *
 * 減算方式のもう一つの穴は、`DEPENDENCIES.app` が広がったときに `forbidden` が追随しないこと
 * である。新しいカーネルを層へ足した人が element 側を忘れると、`route.ts` は何もしなくても
 * そこへ届くようになる。こちらは宣言どうしの突き合わせで閉じる。
 */

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..");

/** element が引いてよいカーネル。ここに無いものは `forbidden` に挙がっていなければならない。 */
const ALLOWED: Readonly<Record<string, readonly Kernel[]>> = {
  "app-route-handler": ["adapters", "model", "errors", "logging"],
  // `config` は 0025 の表に無いが、禁じられているのは server config の直読だけで、層の粒度では
  // client config の公開定数と分けられない（GB-1）。
  "app-server-action": ["adapters", "features", "model", "errors", "logging", "config"],
  "app-metadata": ["adapters", "config", "model"],
};

// ESLint の設定一式を読み込むため、既定の 5 秒では足りない。
const TIMEOUT_MS = 120_000;

async function boundaryErrorsOf(filePath: string, source: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: REPOSITORY_ROOT });
  const [result] = await eslint.lintText(source, { filePath });

  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "boundaries/dependencies")
    .map((message) => message.message);
}

describe("app の element の禁止", () => {
  // ----- 異常系 -----
  it(
    "`route.ts` から feature の内側を引くと落ちる",
    async () => {
      const errors = await boundaryErrorsOf(
        "src/app/api/probe/route.ts",
        'import { loginPath } from "@/features/auth/facade/paths";\nimport { LOGIN_NOTICE } from "@/features/auth/read-login-notice";\n\nexport function GET() {\n  return Response.json({ loginPath, LOGIN_NOTICE });\n}\n',
      );

      expect(errors).toHaveLength(1);
      // 件数だけでは、別の policy が偶然 1 件当たった場合と区別できない。落ちた向き
      // （どの category から、どの層へ）まで見る。
      expect(errors[0]).toContain("app-route-handler");
      expect(errors[0]).toContain("features");
    },
    TIMEOUT_MS,
  );

  it(
    "`route.ts` から UI 部品を引くと落ちる",
    async () => {
      const errors = await boundaryErrorsOf(
        "src/app/api/probe/route.ts",
        'import { cn } from "@/components/cn";\n\nexport function GET() {\n  return Response.json({ cn: typeof cn });\n}\n',
      );

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("app-route-handler");
      expect(errors[0]).toContain("components");
    },
    TIMEOUT_MS,
  );

  // ----- 正常系 -----
  it(
    "`route.ts` から境界アダプタと feature の `facade/` は引ける",
    async () => {
      const errors = await boundaryErrorsOf(
        "src/app/api/probe/route.ts",
        'import { loginPath } from "@/features/auth/facade/paths";\nimport { toSafeReturnUrl } from "@/model/return-url";\n\nexport function GET() {\n  return Response.json({ to: loginPath(toSafeReturnUrl("/")) });\n}\n',
      );

      expect(errors).toEqual([]);
    },
    TIMEOUT_MS,
  );

  it(
    "同じディレクトリの `page.tsx` には、この禁止が掛からない",
    async () => {
      const errors = await boundaryErrorsOf(
        "src/app/api/probe/page.tsx",
        'import { LOGIN_NOTICE } from "@/features/auth/read-login-notice";\n\nexport default function Page() {\n  return <p>{LOGIN_NOTICE.UNAVAILABLE}</p>;\n}\n',
      );

      expect(errors).toEqual([]);
    },
    TIMEOUT_MS,
  );
});

describe("app の element の許可と禁止の網羅", () => {
  // ----- 正常系 -----
  it("層が許すカーネルは、element の許可か禁止のどちらかに必ず属する", () => {
    for (const element of APP_ELEMENTS) {
      const allowed = new Set<string>(ALLOWED[element.category] ?? []);
      const forbidden = new Set<string>(element.forbidden);
      const unclassified = DEPENDENCIES.app.filter(
        (kernel) => !allowed.has(kernel) && !forbidden.has(kernel),
      );

      expect(unclassified, `${element.category} の扱いが決まっていないカーネル`).toEqual([]);
    }
  });

  it("許可と禁止が同じカーネルを挙げていない", () => {
    for (const element of APP_ELEMENTS) {
      const forbidden = new Set<string>(element.forbidden);

      expect((ALLOWED[element.category] ?? []).filter((kernel) => forbidden.has(kernel))).toEqual(
        [],
      );
    }
  });

  // ----- 異常系 -----
  it("層が許していないカーネルを禁止に挙げていない", () => {
    const layer = new Set<string>(DEPENDENCIES.app);

    for (const element of APP_ELEMENTS) {
      // 層が許していないものを禁止に足しても効果は無く、読む人には「ここでだけ禁止している」と
      // 読める。層の側で既に禁止なら、element の宣言から落とす。
      expect(element.forbidden.filter((kernel) => !layer.has(kernel))).toEqual([]);
    }
  });
});

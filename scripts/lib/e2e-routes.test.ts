import { describe, expect, it } from "vitest";

import {
  findStaleAbsentDeclarations,
  findUnknownRoutes,
  listRouteLiterals,
  toAppRoute,
  toRoutePath,
  toRoutePattern,
} from "./e2e-routes";

describe("listRouteLiterals", () => {
  // ----- 正常系 -----
  it("経路の形をしたリテラルだけを拾う", () => {
    expect(
      listRouteLiterals('goto("/about"); expect("見出し"); fetch("https://x.test/y");'),
    ).toEqual(["/about"]);
  });

  it("差し込みで始まるテンプレート文字列は、頭が空なので拾わない", () => {
    expect(listRouteLiterals(`goto(\`\${origin}/api/reports\`);`)).toEqual([]);
  });
});

describe("toAppRoute", () => {
  // ----- 正常系 -----
  it("根の画面を `/` にする", () => {
    expect(toAppRoute("src/app/page.tsx")).toBe("/");
  });

  it("route group を URL から落とす", () => {
    expect(toAppRoute("src/app/(site-info)/reports/page.tsx")).toBe("/reports");
  });

  it("動的区間を綴りのまま残す", () => {
    expect(toAppRoute("src/app/(site-info)/reports/[id]/page.tsx")).toBe("/reports/[id]");
  });

  it("Route Handler も route として数える", () => {
    expect(toAppRoute("src/app/api/health/route.ts")).toBe("/api/health");
  });

  it("開発だけに含まれる Route Handler も数える", () => {
    expect(toAppRoute("src/app/api/auth/test-session/route.dev.ts")).toBe("/api/auth/test-session");
  });

  it("開発だけに含まれる画面も数える", () => {
    expect(toAppRoute("src/app/dev/session/page.dev.tsx")).toBe("/dev/session");
  });

  it("名前で配信経路が決まる特殊ファイルを、その経路にする", () => {
    expect(toAppRoute("src/app/robots.ts")).toBe("/robots.txt");
    expect(toAppRoute("src/app/sitemap.ts")).toBe("/sitemap.xml");
    expect(toAppRoute("src/app/icon.tsx")).toBe("/icon");
    expect(toAppRoute("src/app/apple-icon.tsx")).toBe("/apple-icon");
    expect(toAppRoute("src/app/opengraph-image.tsx")).toBe("/opengraph-image");
  });

  it("`src/app` の外は route にしない", () => {
    expect(toAppRoute("src/features/home/view.tsx")).toBeNull();
  });

  it("route を作らないファイルは数えない", () => {
    expect(toAppRoute("src/app/not-found.tsx")).toBeNull();
  });

  it("並列ルートは自分の URL を持たないので数えない", () => {
    expect(toAppRoute("src/app/admin/@breadcrumb/users/page.tsx")).toBeNull();
  });
});

describe("toRoutePattern", () => {
  // ----- 正常系 -----
  it("`/` に当たる", () => {
    expect(toRoutePattern("/").test("/")).toBe(true);
    expect(toRoutePattern("/").test("/about")).toBe(false);
  });

  it("静的な区間は綴りごと当てる", () => {
    expect(toRoutePattern("/api/health").test("/api/health")).toBe(true);
    expect(toRoutePattern("/api/health").test("/api/healthy")).toBe(false);
  });

  it("動的区間は 1 区間の中身を問わない", () => {
    const pattern = toRoutePattern("/reports/[id]");

    expect(pattern.test("/reports/abc")).toBe(true);
    expect(pattern.test("/reports")).toBe(false);
    expect(pattern.test("/reports/a/b")).toBe(false);
  });

  it("catch-all は 1 区間以上に当たる", () => {
    const pattern = toRoutePattern("/docs/[...slug]");

    expect(pattern.test("/docs/a")).toBe(true);
    expect(pattern.test("/docs/a/b")).toBe(true);
    expect(pattern.test("/docs")).toBe(false);
  });

  it("任意の catch-all は 0 区間にも当たる", () => {
    const pattern = toRoutePattern("/docs/[[...slug]]");

    expect(pattern.test("/docs")).toBe(true);
    expect(pattern.test("/docs/a/b")).toBe(true);
  });

  it("正規表現の記号を含む区間を、綴りとして当てる", () => {
    const pattern = toRoutePattern("/a.b");

    expect(pattern.test("/a.b")).toBe(true);
    expect(pattern.test("/axb")).toBe(false);
  });
});

describe("toRoutePath", () => {
  // ----- 正常系 -----
  it("そのままの経路を返す", () => {
    expect(toRoutePath("/reports")).toBe("/reports");
  });

  it("クエリを落とす", () => {
    expect(toRoutePath("/login?returnUrl=%2Fmypage")).toBe("/login");
  });

  it("フラグメントを落とす", () => {
    expect(toRoutePath("/about#history")).toBe("/about");
  });

  it("末尾の区切りを落とす", () => {
    expect(toRoutePath("/reports/")).toBe("/reports");
  });

  it("`/` は `/` のまま返す", () => {
    expect(toRoutePath("/")).toBe("/");
  });

  it("問い合わせだけの経路も `/` にする", () => {
    expect(toRoutePath("/?first=1")).toBe("/");
  });
});

describe("findUnknownRoutes", () => {
  // ----- 正常系 -----
  it("実在する route に着く経路を報告しない", () => {
    expect(findUnknownRoutes(["/reports/abc"], ["/reports/[id]"], [])).toEqual([]);
  });

  it("実在しないと宣言した経路を報告しない", () => {
    expect(findUnknownRoutes(["/account"], ["/login"], ["/account"])).toEqual([]);
  });

  it("実在しない経路を報告する", () => {
    expect(findUnknownRoutes(["/about"], ["/login"], [])).toEqual([
      "指す先が実在しません: /about（画面を消したか、綴りが違う）",
    ]);
  });

  it("同じ経路を何度指していても 1 度だけ報告する", () => {
    expect(findUnknownRoutes(["/about", "/about?x=1"], ["/login"], [])).toEqual([
      "指す先が実在しません: /about（画面を消したか、綴りが違う）",
    ]);
  });
});

describe("findStaleAbsentDeclarations", () => {
  // ----- 正常系 -----
  it("spec が指していて実在しない宣言を報告しない", () => {
    expect(findStaleAbsentDeclarations(["/account"], ["/login"], ["/account"])).toEqual([]);
  });

  it("どの spec も指していない宣言を報告する", () => {
    expect(findStaleAbsentDeclarations(["/login"], ["/login"], ["/account"])).toEqual([
      "どの spec も指していない宣言です: /account",
    ]);
  });

  it("実在するようになった宣言を報告する", () => {
    expect(findStaleAbsentDeclarations(["/account"], ["/account"], ["/account"])).toEqual([
      "実在しないと宣言した経路に画面があります: /account",
    ]);
  });
});

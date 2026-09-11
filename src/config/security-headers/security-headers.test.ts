import { describe, expect, it } from "vitest";

import { buildSecurityHeaders, type SecurityHeaderInputs } from "./security-headers";

const production: SecurityHeaderInputs = {
  apiOrigin: "https://api.example.com",
  mediaOrigin: "https://media.example.com",
  authIssuer: "https://idp.example.com/realms/shop",
  servesOverTls: true,
  development: false,
  gtmContainerId: "",
};

const local: SecurityHeaderInputs = {
  apiOrigin: "http://localhost:8081",
  mediaOrigin: "http://media.example.test:9000",
  authIssuer: "http://localhost:2010/default",
  servesOverTls: false,
  development: true,
  gtmContainerId: "",
};

/** 容器 ID を宣言した配備。タグマネージャを読み込む。 */
const withTagManager: SecurityHeaderInputs = { ...production, gtmContainerId: "GTM-ABC1234" };

function header(inputs: SecurityHeaderInputs, key: string): string | undefined {
  return buildSecurityHeaders(inputs).find((entry) => entry.key === key)?.value;
}

/** CSP をディレクティブ名 → source 一覧へ分解する。 */
function directives(inputs: SecurityHeaderInputs): Map<string, readonly string[]> {
  const policy = header(inputs, "Content-Security-Policy") ?? "";

  return new Map(
    policy.split("; ").map((directive) => {
      const [name, ...sources] = directive.split(" ");
      return [name ?? "", sources];
    }),
  );
}

describe("buildSecurityHeaders", () => {
  // ----- 正常系 -----
  it("同一 origin を既定にし、object と埋め込み元を閉じる", () => {
    const csp = directives(production);

    expect(csp.get("default-src")).toStrictEqual(["'self'"]);
    expect(csp.get("object-src")).toStrictEqual(["'none'"]);
    expect(csp.get("base-uri")).toStrictEqual(["'self'"]);
    expect(csp.get("frame-ancestors")).toStrictEqual(["'none'"]);
  });

  it("画像の配信元を ENV の origin から組み立てる", () => {
    expect(directives(production).get("img-src")).toStrictEqual([
      "'self'",
      "blob:",
      "https://media.example.com",
    ]);
  });

  it("配信元にパスやポートが付いていても origin だけを載せる", () => {
    expect(directives(local).get("img-src")).toContain("http://media.example.test:9000");
    expect(directives(local).get("form-action")).toStrictEqual(["'self'", "http://localhost:2010"]);
  });

  it("form の送信先に IdP の origin を含める", () => {
    expect(directives(production).get("form-action")).toStrictEqual([
      "'self'",
      "https://idp.example.com",
    ]);
  });

  it("本番の script は inline だけを許し eval を許さない", () => {
    expect(directives(production).get("script-src")).toStrictEqual(["'self'", "'unsafe-inline'"]);
  });

  it("開発サーバーでは eval を許す", () => {
    expect(directives(local).get("script-src")).toStrictEqual([
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
    ]);
  });

  it("https で配信しているときは HSTS と upgrade-insecure-requests を出す", () => {
    expect(header(production, "Strict-Transport-Security")).toBe("max-age=31536000");
    expect(directives(production).has("upgrade-insecure-requests")).toBe(true);
  });

  it("http で配信しているときは HSTS も upgrade-insecure-requests も出さない", () => {
    expect(header(local, "Strict-Transport-Security")).toBeUndefined();
    expect(directives(local).has("upgrade-insecure-requests")).toBe(false);
  });

  it("style と font は同一 origin に閉じ、style だけ inline を許す", () => {
    const csp = directives(production);

    expect(csp.get("style-src")).toStrictEqual(["'self'", "'unsafe-inline'"]);
    expect(csp.get("font-src")).toStrictEqual(["'self'"]);
  });

  it("購読の宛先だけを connect-src へ開ける", () => {
    // 取得は同一オリジンの中継が担うので `'self'` で足りる。ブラウザが直接開くのは購読だけ。
    expect(directives(production).get("connect-src")).toStrictEqual([
      "'self'",
      "https://api.example.com",
    ]);
  });

  it("clickjacking と MIME sniffing を閉じる", () => {
    expect(header(production, "X-Frame-Options")).toBe("DENY");
    expect(header(production, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("別 origin との文脈共有を閉じる", () => {
    expect(header(production, "Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(header(production, "Cross-Origin-Embedder-Policy")).toBe("require-corp");
    expect(header(production, "Cross-Origin-Resource-Policy")).toBe("same-origin");
  });

  it("Referer は別 origin へ origin だけを送る", () => {
    expect(header(production, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("使わない強力な機能を閉じる", () => {
    expect(header(production, "Permissions-Policy")).toBe(
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    );
  });

  it("ディレクティブは 1 つの空白で区切り、末尾に区切りを残さない", () => {
    const policy = header(production, "Content-Security-Policy") ?? "";

    expect(policy).not.toMatch(/\s{2,}/);
    expect(policy.endsWith(";")).toBe(false);
  });

  it("容器 ID を宣言した配備は、タグマネージャの配信元を script-src へ載せる", () => {
    expect(directives(withTagManager).get("script-src")).toContain(
      "https://www.googletagmanager.com",
    );
  });

  it("容器 ID を宣言した配備は、計測の送り先を connect-src と img-src へ載せる", () => {
    const declared = directives(withTagManager);

    expect(declared.get("connect-src")).toContain("https://*.google-analytics.com");
    expect(declared.get("img-src")).toContain("https://*.google-analytics.com");
  });

  it("代表的なホストをワイルドカードと重ねて挙げない", () => {
    expect(directives(withTagManager).get("connect-src")).not.toContain(
      "https://www.google-analytics.com",
    );
  });

  it("容器 ID を宣言した配備は、cross-origin isolation を降ろす", () => {
    expect(header(withTagManager, "Cross-Origin-Embedder-Policy")).toBeUndefined();
  });

  it("読み込まない配備は、配信元を開けず isolation も保つ", () => {
    const declared = directives(production);

    expect(declared.get("script-src")).not.toContain("https://www.googletagmanager.com");
    expect(declared.get("connect-src")).not.toContain("https://*.google-analytics.com");
    expect(header(production, "Cross-Origin-Embedder-Policy")).toBe("require-corp");
  });
});

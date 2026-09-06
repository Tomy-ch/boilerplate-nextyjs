import { expect, test } from "../lib/test";

/**
 * 別 origin からの要求の前捌き（[0111](../../docs/adr/0111-csp-security-headers.md) §5 / `docs/rules.md` #47）。
 *
 * @remarks
 * 開く側は、宣言した origin の文書から fetch して確かめます。宣言（`HTTP_ALLOWED_ORIGINS`）と文書を
 * 返すサーバは起動側が用意し（`E2E_ALLOWED_ORIGIN`、`scripts/e2e/partner-origin.ts`）、spec は
 * 同じ綴りを読みます。preflight の自動発行と読み取りの制限は実ブラウザにしか無く、Node 側の
 * client（`page.request`）では通せません。
 *
 * 閉じる側の 403 は設計された結果なので見張りには掛かりません（[`lib/browser-errors.ts`](../lib/browser-errors.ts)）。
 */

/** 宣言に無い別 origin。 */
const FOREIGN_ORIGIN = "https://foreign.invalid";

/** 起動側が宣言した別 origin。起動側を通さずに開いた環境では、この spec は成立しない。 */
const ALLOWED_ORIGIN = process.env["E2E_ALLOWED_ORIGIN"] ?? "http://host.docker.internal:3102";

/**
 * 読むだけの BFF の口。
 *
 * @remarks
 * CORS を開くのは接頭辞（`/api/`）で決まるので、口の中身は問いません。**題材に依らない**口を
 * 指します（[README](../README.md)）。
 */
const READ_PATH = "/api/health";

test("宣言した origin の文書から BFF を読める", async ({ page, baseURL }) => {
  await page.goto(`${ALLOWED_ORIGIN}/`);

  const result = await page.evaluate(
    async ({ target, path }) => {
      const response = await fetch(`${target}${path}`, { credentials: "include" });
      return { status: response.status, hasBody: (await response.text()).length > 0 };
    },
    { target: baseURL, path: READ_PATH },
  );

  expect(result).toStrictEqual({ status: 200, hasBody: true });
});

test("宣言した origin からの preflight を要する要求は BFF まで届く", async ({ page, baseURL }) => {
  await page.goto(`${ALLOWED_ORIGIN}/`);

  // JSON の POST は preflight を要する。届いた証拠は、CORS で読めないときに fetch が投げる
  // TypeError ではなく、handler の返した状態が読めること。
  const status = await page.evaluate(async (target) => {
    const response = await fetch(`${target}/api/telemetry`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return response.status;
  }, baseURL);

  expect(status).not.toBe(403);
});

test("宣言に無い origin からの書き込みは handler へ届く前に 403 で止まる", async ({ page }) => {
  const response = await page.request.post("/api/telemetry", {
    headers: { origin: FOREIGN_ORIGIN, "content-type": "application/json" },
    data: {},
  });

  expect(response.status()).toBe(403);
});

test("宣言に無い origin からの preflight に CORS ヘッダを返さない", async ({ page }) => {
  const response = await page.request.fetch(READ_PATH, {
    method: "OPTIONS",
    headers: { origin: FOREIGN_ORIGIN, "access-control-request-method": "GET" },
  });

  expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
});

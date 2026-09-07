import { expect, test } from "@playwright/test";

/**
 * CSP が配信され、ブラウザが enforce していること。
 * 見張りの外で書く理由は `e2e/README.md`「何を異常と数えるか」。
 */

/** 宣言に無い配信元。解決しない名前を使い、CSP より後ろへ行かないことを確かにする。 */
const FOREIGN_SCRIPT = "https://probe.invalid/script.js";

/**
 * 差し込む先の画面。
 *
 * @remarks
 * CSP は配信するヘッダなので、どの画面でも同じものが掛かります。選び方は同意の spec と同じで、
 * **題材に依らず、バックエンドから何も取らない**画面を指します（[`consent.spec.ts`](consent.spec.ts)）。
 */
const ENTRY_PATH = "/login";

test("宣言に無い配信元の script は実行されず、違反として報告される", async ({ page }) => {
  await page.goto(ENTRY_PATH);

  const violated = await page.evaluate(
    (src) =>
      new Promise<string>((resolve) => {
        document.addEventListener(
          "securitypolicyviolation",
          (event) => resolve(event.violatedDirective),
          { once: true },
        );

        const script = document.createElement("script");
        script.src = src;
        document.head.append(script);
      }),
    FOREIGN_SCRIPT,
  );

  // 描画エンジンによって、割った側（`-elem`）で報告するか元のディレクティブで報告するかが違う。
  expect(["script-src", "script-src-elem"]).toContain(violated);
});

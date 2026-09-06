import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { test as base, expect, type Page } from "@playwright/test";
import { EXCLUDED_STORIES } from "./lib/excluded-stories";
import { settle } from "./lib/settle";
import { createStaticServer } from "./lib/static-server";
import { excludeDeclared, parseStoryIndex, storyURL } from "./lib/story-index";
import {
  semanticColorTokens,
  semanticNonColorTokens,
  type TokenProbe,
  type TokenReadings,
} from "./lib/theme-tokens";

/**
 * 配色テーマが面へ効いていることを、テーマごとに見る。
 *
 * @remarks
 * 全 story を撮り axe を掛けるのは片方のテーマだけです([themes](lib/themes.ts))。ここが埋めるのは、
 * それによって空く 1 点 —— **撮らない側のテーマの適用経路だけが壊れる**場合です。
 *
 * ほかの壊れ方は既に別の検査が持っています。SSOT と生成物のずれは `tokens-drift` が、生成物が
 * そもそも読まれない状態は撮る側のテーマの全 story 撮影が捕まえます。ここで値そのものを持つと、
 * 同じ表を 2 箇所に持つことになります。
 */

const STORYBOOK_DIR = "storybook-static";
const TOKENS_CSS = "src/app/generated/tokens.css";

const CSS = readFileSync(TOKENS_CSS, "utf8");
const TOKENS = semanticColorTokens(CSS);
const OTHER_TOKENS = semanticNonColorTokens(CSS);

// どの story でもよい。見るのは story の中身ではなく、story を包む面に配色が乗っているか。
const [PROBE_STORY] = excludeDeclared(
  parseStoryIndex(readFileSync(`${STORYBOOK_DIR}/index.json`, "utf8")),
  EXCLUDED_STORIES,
);

const test = base.extend<Record<never, never>, { storybookURL: string }>({
  storybookURL: [
    async ({}, use) => {
      const server = createStaticServer(STORYBOOK_DIR).listen(0, "127.0.0.1");
      await once(server, "listening");
      const { port } = server.address() as AddressInfo;

      await use(`http://127.0.0.1:${port}`);

      server.close();
    },
    { scope: "worker" },
  ],
  baseURL: async ({ storybookURL }, use) => {
    await use(storybookURL);
  },
});

/**
 * 意味トークンを、継承する色が違う 2 つの面で読む。
 *
 * 変数の宣言ではなく変数を使った結果を読むのは、宣言のまま読むと `var(...)` が解決前の文字列で
 * 返る browser があるため。2 面で読む理由は {@link TokenReadings} にある。
 */
async function readTokens(
  page: Page,
  names: readonly string[],
  surface?: string,
): Promise<Record<string, TokenReadings>> {
  return page.evaluate(
    ([tokens, surfaceName]) => {
      const parents = ["rgb(1, 2, 3)", "rgb(4, 5, 6)"].map((inherited) => {
        const parent = document.createElement("div");
        parent.style.color = inherited;
        parent.append(document.createElement("div"));
        if (surfaceName !== undefined) parent.dataset["surface"] = surfaceName;
        document.body.append(parent);

        return parent;
      });

      const readings: Record<string, [string, string]> = {};
      for (const token of tokens) {
        const [first, second] = parents.map((parent) => {
          const probe = parent.firstElementChild as HTMLElement;
          probe.style.color = `var(${token})`;

          return getComputedStyle(probe).color;
        });
        readings[token] = [first as string, second as string];
      }
      for (const parent of parents) parent.remove();

      return readings;
    },
    [names, surface] as [readonly string[], string | undefined],
  );
}

/**
 * 色以外の意味トークンを、指定した系統の部分木で読む。
 *
 * @remarks
 * 読み取りに使うプロパティが型ごとに違うため、変数名と対で受け取ります。
 */
async function readOther(
  page: Page,
  probes: readonly TokenProbe[],
  surface?: string,
): Promise<Record<string, string>> {
  return page.evaluate(
    ([entries, surfaceName]) => {
      const host = document.createElement("div");
      if (surfaceName !== undefined) host.dataset["surface"] = surfaceName;
      const probe = document.createElement("div");
      host.append(probe);
      document.body.append(host);

      const readings: Record<string, string> = {};
      for (const { name, property } of entries) {
        probe.style.setProperty(
          property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
          `var(${name})`,
        );
        readings[name] = getComputedStyle(probe)[property as "color"];
      }
      host.remove();

      return readings;
    },
    [probes, surface] as [readonly TokenProbe[], string | undefined],
  );
}

test.describe("配色トークン", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (PROBE_STORY === undefined) throw new Error("撮影対象が 1 つもありません");
    await page.goto(storyURL(PROBE_STORY.id, testInfo.project.name));
    await settle(page, testInfo.project.name);
  });

  // ----- 正常系 -----
  test("面の明暗が配色テーマと一致する", async ({ page }, testInfo) => {
    const scheme = await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    );

    expect(scheme).toBe(testInfo.project.name);
  });

  test("もう一方のテーマとは違う配色になる", async ({ page }, testInfo) => {
    const own = await readTokens(page, TOKENS);
    await page.evaluate(
      (theme) => {
        document.documentElement.dataset["theme"] = theme;
      },
      testInfo.project.name === "dark" ? "light" : "dark",
    );
    const other = await readTokens(page, TOKENS);

    // 全部が違う必要はない。両テーブルが丸ごと同じなら、テーマの切り替えが効いていない。
    expect(other, "テーマを切り替えても配色が変わりません").not.toEqual(own);
  });

  test("系統を指定した部分木では配色以外も入れ替わる", async ({ page }) => {
    const outside = await readOther(page, OTHER_TOKENS);
    const inside = await readOther(page, OTHER_TOKENS, "admin");

    // 系統は書体・太さ・影も替える。色だけを見ると、`--font-*` の別名を手書き CSS から直接
    // 引いた箇所のように、その系統だけ届かない壊れ方を素通しする。
    expect(inside, "data-surface を置いても配色以外が変わりません").not.toEqual(outside);
  });

  test("系統を指定した部分木では別の配色になる", async ({ page }) => {
    const outside = await readTokens(page, TOKENS);
    const inside = await readTokens(page, TOKENS, "admin");

    // 生成物では `[data-surface]` が `:root` を上書きする。同じなら再束縛が届いていない。
    expect(inside, "data-surface を置いても配色が変わりません").not.toEqual(outside);
  });
});

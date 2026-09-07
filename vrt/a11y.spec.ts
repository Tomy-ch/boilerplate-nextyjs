import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect } from "@playwright/test";
import { CONFORMANCE_TAGS, disabledRuleIds } from "./lib/a11y-rules";
import { EXCLUDED_STORIES } from "./lib/excluded-stories";
import { settle } from "./lib/settle";
import { createStaticServer } from "./lib/static-server";
import { excludeDeclared, parseStoryIndex, selectStories, storyURL } from "./lib/story-index";
import { openAtDeclaredViewport } from "./lib/viewport";

// Storybook の全 story に axe を掛ける。「a11y の自動検査を story に効かせる」を、追加のランナーを
// 入れずに満たす経路（[README](README.md)）。
//
// **実ブラウザであることが本質。** component テストの `vitest-axe` は jsdom で走るため色コント
// ラストを検査できず、実際に無効化されている。ここは light / dark の両方を実描画するので、
// テーマの切り替えでしか出ない contrast の違反まで届く。

const STORYBOOK_DIR = "storybook-static";

const stories = selectStories(
  excludeDeclared(
    parseStoryIndex(readFileSync(`${STORYBOOK_DIR}/index.json`, "utf8")),
    EXCLUDED_STORIES,
  ),
  process.env["VRT_ONLY"],
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

for (const story of stories) {
  const details = { annotation: { type: "story", description: story.id } };

  test(`${story.title} / ${story.name}`, details, async ({ page }, testInfo) => {
    // 描画中に投げた例外を先に見る。壊れた story は待ち合わせが成立せず時間切れになるが、
    // 時間切れは原因を語らない。例外そのものを出しておかないと、読む人は Storybook を開いて
    // 探し直すことになる。
    const crashes: Error[] = [];
    page.on("pageerror", (error) => crashes.push(error));

    const url = storyURL(story.id, testInfo.project.name);
    await page.goto(url);
    await settle(page, testInfo.project.name);

    // 撮影と同じ幅で見る。宣言された幅でしか出ない違反（畳んだ操作面の名前・順序）がある。
    if (await openAtDeclaredViewport(page, url)) {
      await settle(page, testInfo.project.name);
    }

    expect(crashes.map((crash) => crash.message)).toEqual([]);

    const { violations } = await new AxeBuilder({ page })
      .withTags([...CONFORMANCE_TAGS])
      .disableRules(disabledRuleIds(story.id))
      .analyze();

    // 件数ではなく違反そのものを並べる。どのルールがどの要素で落ちたかが出ないと、
    // 落ちた人は Storybook を開いて探し直すことになる。
    expect(
      violations.map((violation) => ({
        rule: violation.id,
        help: violation.help,
        nodes: violation.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}

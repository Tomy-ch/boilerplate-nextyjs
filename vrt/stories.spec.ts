import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { test as base, expect, type TestInfo } from "@playwright/test";
import { listBaselines } from "../baseline/lib/orphans";
import { noteBaselineGap } from "../baseline/lib/report-gap";
import { assertAreaUnclaimed, isRetaking } from "../baseline/lib/store";
import { installFixedClock } from "./lib/clock";
import { EXCLUDED_STORIES } from "./lib/excluded-stories";
import { BASELINE_TAG, expectedBaselines } from "./lib/expected-baselines";
import { settle } from "./lib/settle";
import { createStaticServer } from "./lib/static-server";
import { excludeDeclared, parseStoryIndex, selectStories, storyURL } from "./lib/story-index";
import { openAtDeclaredViewport } from "./lib/viewport";

// Storybook の全 story を基準画像と比べる。
//
// 比較単位を story に取る理由は [README](README.md) にある。

/** 撮影対象。`pnpm build-storybook` の出力先。 */
const STORYBOOK_DIR = "storybook-static";

const shootable = excludeDeclared(
  parseStoryIndex(readFileSync(`${STORYBOOK_DIR}/index.json`, "utf8")),
  EXCLUDED_STORIES,
);

// 置き場は画面単位の撮影と共有している。系統が相手の区画を名乗ったまま撮ると、両者の画像が
// 同じ場所に混ざる。
assertAreaUnclaimed(shootable.map((story) => story.group));

const stories = selectStories(shootable, process.env["VRT_ONLY"]);

// ポートは OS に選ばせる。固定のポートで単一のサーバを外から与えると、worktree を並べた分だけ
// 衝突する。
const test = base.extend<Record<never, never>, { storybookURL: string }>({
  storybookURL: [
    // 第 1 引数は空の分割代入でなければならない。Playwright はここに並べた名前を
    // この fixture の依存として読むため、名前付きの引数にすると解釈できない。
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
  // story の id を注記として残す。承認経路は落ちた story を id で絞るため、見出しの文字列から
  // 逆引きせずに済ませる。
  const details = { annotation: { type: "story", description: story.id } };

  test(`${story.title} / ${story.name}`, details, async ({ page }, testInfo) => {
    const crashes: Error[] = [];
    page.on("pageerror", (error) => crashes.push(error));

    // 時計はページを開く前に固定する。
    await installFixedClock(page);
    const url = storyURL(story.id, testInfo.project.name);
    await page.goto(url);
    await settle(page, testInfo.project.name);

    // 宣言を読めるのは描き終えてからで、開き直した後はもう一度描き切るのを待つ。
    if (await openAtDeclaredViewport(page, url)) {
      await settle(page, testInfo.project.name);
    }

    // 描画中に投げた例外は、画像が撮れてしまうぶん差分に出ないことがある。壊れた story を
    // 「見た目が変わっていない」で通さないため、画像より先に見る。
    expect(crashes.map((crash) => crash.message)).toEqual([]);

    // 配列で渡す。1 本の文字列にすると Playwright が `/` をファイル名として無害化するので、
    // 系統ごとに分かれず 1 階層へ平置きされる。
    await expect(page).toHaveScreenshot([story.group, testInfo.project.name, `${story.id}.png`]);
  });
}

// 撮影対象と基準画像の対応。範囲を絞った実行(`VRT_ONLY`)では、対象外の story の画像と孤児を
// 区別できないため見ない。比較を省いた実行でもここだけは走る(`make vrt`)。
if (!process.env["VRT_ONLY"]) {
  test("基準画像 / 撮影対象と 1 対 1 で対応する", { tag: BASELINE_TAG }, ({}, testInfo) => {
    test.skip(isRetaking(process.env), "撮り直しの最中は対応を見ない");

    const { orphans, missing } = noteBaselineGap(
      testInfo.annotations,
      listBaselines(baselineRoot(testInfo)),
      expectedBaselines(shootable),
    );

    expect(orphans, "撮り直して置き場へ送るか、対応する story を戻してください").toEqual([]);
    expect(missing, "make vrt-retake で撮り直してください").toEqual([]);
  });
}

// 置き場の位置は `playwright.config.ts` の `snapshotPathTemplate` が決める。撮影と同じ解決を
// 通してから 3 区画(系統 / テーマ / ファイル名)ぶん遡る。
function baselineRoot(testInfo: TestInfo): string {
  return path.resolve(testInfo.snapshotPath("group", "theme", "story.png"), "../../..");
}

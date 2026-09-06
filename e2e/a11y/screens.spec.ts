import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";

import { CONFORMANCE_TAGS, SCREEN_ONLY_RULES, screenDisabledRuleIds } from "../lib/a11y-rules";
import {
  listScreenRoutes,
  resolveScreens,
  SCREEN_MANIFEST_FILE,
  SCREENS,
  selectScreens,
} from "../lib/screens";
import { expect, test } from "../lib/test";

/**
 * 画面 1 枚ぶんに axe を掛ける。
 *
 * @remarks
 * landmark・`main`・h1 と、配信される document は story 単位の検査（`vrt/a11y.spec.ts`）では
 * 成立せず、ここでだけ見られます（[README](../README.md) の「画面単位の a11y」）。前者 3 つを
 * 持つのは [`SCREEN_ONLY_RULES`](../lib/a11y-rules.ts) で、適合目標のタグでは走らないため
 * **axe を 2 度に分けて掛けます**。
 *
 * 開く画面は撮影と同じ一覧（[screens](../lib/screens.ts)）から採ります。手で持つと、新しく
 * 足した画面が黙って対象外のまま残ります。
 *
 * **回すエンジンは 1 つです。** 見ているのは DOM の構造で、描画エンジンでは変わりません。
 * どのエンジンで回すかは `playwright.e2e.config.ts` が決めます。
 */

const screens = selectScreens(
  resolveScreens(listScreenRoutes(readFileSync(SCREEN_MANIFEST_FILE, "utf8")), SCREENS),
  process.env["E2E_ONLY"],
);

for (const screen of screens) {
  test(screen.name, async ({ page, signIn }) => {
    if (screen.signedIn !== undefined) {
      await signIn(screen.signedIn);
    }

    await page.goto(screen.path);
    // 撮影と同じ待ち合わせを通す。待たずに評価すると、`Suspense` の fallback（skeleton）を
    // 画面として見てしまう。skeleton は landmark も見出しも持たないことが多く、**違反が出ない**
    // 方向へ倒れるので、偽陰性は結果からは判らない。
    await page.evaluate(() => document.fonts.ready);

    const disabled = screenDisabledRuleIds(screen.name);
    const conformance = await new AxeBuilder({ page })
      .withTags([...CONFORMANCE_TAGS])
      .disableRules(disabled)
      .analyze();
    const structural = await new AxeBuilder({ page })
      .withRules([...SCREEN_ONLY_RULES])
      .disableRules(disabled)
      .analyze();
    const violations = [...conformance.violations, ...structural.violations];

    // 件数ではなく違反そのものを並べる。どのルールがどの要素で落ちたかが出ないと、
    // 落ちた人は画面を開いて探し直すことになる。
    expect(
      violations.map((violation) => ({
        rule: violation.id,
        help: violation.help,
        nodes: violation.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}

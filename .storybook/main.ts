import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";

/** カタログだけへ配る資材の置き場（`public/README.md`）。写してくる実体だけを追跡から外す。 */
const catalogAssets = fileURLToPath(new URL("./public", import.meta.url));

/**
 * 取得を横取りする service worker を、依存が持つ実体からカタログの資材へ写す。
 *
 * 起動コマンドではなくここで写すのは、置き忘れた状態で `storybook build` に入ると
 * `staticDirs` の解決で落ちるためで、その前提を script の書き方に依存させない。
 */
function copyMockServiceWorker(): void {
  mkdirSync(catalogAssets, { recursive: true });
  copyFileSync(
    createRequire(import.meta.url).resolve("msw/mockServiceWorker.js"),
    `${catalogAssets}/mockServiceWorker.js`,
  );
}

copyMockServiceWorker();

const config: StorybookConfig = {
  // token の目録は `.storybook/` に置く（配置の根拠は `src/components/README.md`）
  stories: ["../src/**/*.stories.@(ts|tsx)", "./*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  // 配信もアプリの `public/` と分ける（ADR 0054）
  staticDirs: ["../public", "./public"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  // カタログの build は CI の全 workflow の中で最も多く回る（vrt / a11y / storybook-build /
  // deploy-docs）。既定のままだと、そのたびに storybook.js.org へ使用状況と更新確認が出る。
  // 送る相手はこのリポジトリの利用者ではなく、雛形として配られた先の CI であり、送る値の
  // 中身も送り先も、テンプレートから作った側が選んだものではない。
  core: {
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
};

export default config;

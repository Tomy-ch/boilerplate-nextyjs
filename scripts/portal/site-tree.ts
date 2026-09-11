import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** 配信ツリーを組み立てる位置。既定は配信 workflow と `pnpm portal:preview` が使う実物。 */
export type SiteTreeLayout = {
  /** サイトルートへ写す元。`docs.json` が書く `../<dir>/<file>` の基準になる。 */
  docsDir: string;
  /** ビューアーの bundle。生成済みの guides と `docs.json` の上へ重ねる。 */
  viewerDist: string;
  /** Storybook の出力。無ければ `/storybook/` を作らない。 */
  storybookDist: string;
  siteRoot: string;
};

export const DEFAULT_SITE_TREE_LAYOUT: SiteTreeLayout = {
  docsDir: "docs",
  viewerDist: join("docs-viewer", "dist"),
  storybookDist: "storybook-static",
  siteRoot: "dist",
};

/**
 * サイトツリーを組み立てる。
 *
 * @remarks
 * `docs/` をサイトルートへ写します。走査で自動発見したドキュメントは `docs.json` へ
 * `../<dir>/<file>` として書かれており、この配置でなければ全て死にリンクになります。
 *
 * Storybook は任意です。先に `pnpm build-storybook` を走らせていなければ `/storybook/` を
 * 作らず、portal 自体は問題なく動きます。
 *
 * @returns Storybook を含めたかどうか
 */
/* istanbul ignore next -- 既定の配置はリポジトリの実パスを指し、呼ぶと `dist` を作り直す。
   この既定が効くのは CLI から呼ぶときだけで、テストは必ず配置を渡す。 */
export function buildSiteTree(layout: SiteTreeLayout = DEFAULT_SITE_TREE_LAYOUT): {
  storybook: boolean;
} {
  rmSync(layout.siteRoot, { force: true, recursive: true });
  mkdirSync(layout.siteRoot, { recursive: true });

  cpSync(layout.docsDir, layout.siteRoot, { recursive: true });
  cpSync(layout.viewerDist, join(layout.siteRoot, "portal"), { recursive: true });

  const storybook = existsSync(layout.storybookDist);

  if (storybook) {
    cpSync(layout.storybookDist, join(layout.siteRoot, "storybook"), { recursive: true });
  }

  return { storybook };
}

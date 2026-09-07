import type { MetadataRoute } from "next";

import { getSiteConfig } from "@/config/site/site.server";
import { PROTECTED_PREFIXES } from "@/model/authz";

/** 検索エンジンへ知らせるサイトマップの経路。`sitemap.ts` が配る。 */
const SITEMAP_PATH = "/sitemap.xml";

/**
 * クローラ制御（[0044](../../docs/adr/0044-seo-metadata-strategy.md) §2）。
 *
 * @remarks
 * **索引させない環境では全経路を断ります**（`docs/rules.md`「設定と環境」の「索引させてよい環境だけが
 * `SITE_INDEXABLE=on` を宣言する」）。画面の `noindex` と二重にしているのは、`robots.txt` が巡回そのものを止め、`noindex` が巡回した結果を索引から外すもので、
 * 効く相手が違うためです。
 *
 * 巡回を断る経路は、保護している経路の宣言（`model/authz`）から採ります。ここに書き写すと、
 * 保護を足した画面が巡回だけ許された状態を作れます。`robots.txt` の照合は接頭辞のままで区切りを
 * 見ませんが、広く断る側に外れるだけなので害はありません。
 *
 * 静的に描かれ、build 時の設定が焼き込まれます（`config/site/site.server.ts`）。
 */
export default function robots(): MetadataRoute.Robots {
  const site = getSiteConfig();

  if (!site.isIndexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PROTECTED_PREFIXES] },
    sitemap: `${site.publicOrigin}${SITEMAP_PATH}`,
  };
}

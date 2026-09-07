import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache"; // sample:line
import { connection } from "next/server";

import { getPublicProductIds } from "@/adapters/server/api/public-products"; // sample:line
import { getSiteConfig } from "@/config/site/site.server";
import { toProductDetailHref } from "@/features/products/facade/detail-url/detail-url"; // sample:line

/**
 * 1 つのサイトマップに載せてよい URL の上限。
 *
 * @remarks
 * Sitemaps protocol の値です。超える規模は `generateSitemaps` で分割するのが規約であり、
 * 分け方は経路の構成で決まるためテンプレートから作った側の判断です。ここでは上限で打ち切り、
 * 載せ切れないものを黙って落とすのではなく、分割が要ることが挙げた件数から読めるようにします。
 */
const SITEMAP_URL_LIMIT = 50_000;

/**
 * 誰でも開ける画面の経路。
 *
 * @remarks
 * 認証の要る画面と、開けても索引させない画面（ログイン・停止画面）は挙げません。
 * サイトマップは「索引してほしいもの」の宣言で、到達できるものの一覧ではありません。
 * `/` はどのサイトにもあるので、題材を破棄しても残します。
 */
const PUBLIC_PATHS: readonly string[] = [
  "/",
  // sample:begin
  "/products",
  "/about",
  "/privacy",
  "/terms",
  // sample:end
];

// sample:begin
/**
 * 公開中の商品すべての経路。
 *
 * @remarks
 * 一覧の口は cursor で区切って返すため、末尾まで辿ります。**辿った結果は要求をまたいで
 * 持ちます**（`use cache`）。クローラは同じ URL を繰り返し開くので、開くたびに末尾まで辿ると
 * 1 要求が一覧の件数ぶんの backend 呼び出しへ膨らみます。`cacheLife` は「日に何度か変わる」
 * 商品の一覧に合わせています。
 *
 * 主体を名乗らない口を使うのは、`use cache` の中で cookie を読めないためです
 * （`adapters/server/api/public-products`）。
 */
async function listProductPaths(): Promise<string[]> {
  "use cache";
  cacheLife("hours");

  const paths: string[] = [];
  let after: string | undefined;

  do {
    const page = await getPublicProductIds(after);

    paths.push(...page.items.map((id) => toProductDetailHref(id)));
    after = page.nextCursor ?? undefined;
  } while (after !== undefined && paths.length < SITEMAP_URL_LIMIT);

  return paths;
}

/**
 * 商品の経路。取れなければ空。
 *
 * @remarks
 * 一覧の取得が失敗しても、backend に依らない経路まで一緒に落としません。500 を返すと、
 * クローラは静的な画面の存在まで知れなくなります。失敗の分類と記録は `adapters` の境界が
 * 済ませているので、ここでは記録し直しません。
 */
async function findProductPaths(): Promise<string[]> {
  try {
    return await listProductPaths();
  } catch {
    return [];
  }
}
// sample:end

/**
 * サイトマップ。
 *
 * @remarks
 * **build では組み立てません。** 挙げる経路にはバックエンドから取る一覧が混ざり、build 時に
 * 取ると配信物を作る場所からバックエンドへ届くことが前提になり、その時点の一覧が焼き込まれます。
 * `connection()` を待つのはそのためで、`robots.txt` が静的なのと対照的です。一覧そのものは
 * 要求をまたいで持つので、要求のたびに辿り直しはしません。
 *
 * `lastModified` / `changeFrequency` / `priority` は付けません。更新日時は契約が返さず、残りは
 * 検索エンジンが参考程度にしか読まない値で、根拠の無い数を並べる意味がありません。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();

  const { publicOrigin } = getSiteConfig();
  // sample:replace-begin
  const paths = [...PUBLIC_PATHS, ...(await findProductPaths())];
  // sample:replace-with
  // = const paths = [...PUBLIC_PATHS];
  // sample:replace-end

  return paths.slice(0, SITEMAP_URL_LIMIT).map((path) => ({ url: `${publicOrigin}${path}` }));
}

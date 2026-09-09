import "server-only";

import { cache } from "react";
import type { z } from "zod";

import { getApiConfig } from "@/config/api/api.server";
import { getHttpConfig } from "@/config/http/http.server";
import type { CursorPage } from "@/model/pagination";
import type {
  Product,
  ProductDraft,
  ProductEdit,
  ProductId,
  ProductImageDraft,
  ProductListItem,
  ProductPage,
  ProductRankingEntry,
} from "@/model/product/product";
import { toProductId } from "@/model/product/product";
import { type TimeWindow, WHOLE_TIME } from "@/model/time-window";
import {
  GetProductsCountResponse,
  GetProductsDetailResponse,
  GetProductsQueryParams,
  GetProductsRankingQuantityResponse,
  GetProductsResponse,
  getProductsQueryCategoryCodesMax,
  PatchProductsDetailResponse,
  PatchProductsStockResponse,
  PostProductsImagesResponse,
  PostProductsResponse,
} from "../../gen/api/endpoints.zod";
import type {
  ProductPatchRequest,
  ProductStockPatchRequest,
  ProductsPostRequest,
} from "../../gen/api/model";
import { getAccessToken } from "../auth/session";
import { createHttpClient, type UserScopedHttpClient } from "../http/request";
import { resolveMediaUrl } from "../media/media-url";

type WireProductQuery = z.infer<typeof GetProductsQueryParams>;

/**
 * 契約が受け付ける並び順。
 *
 * @remarks
 * 値そのものは契約の enum です。`satisfies` で生成スキーマの型に照らしてあるため、契約から
 * 値が消えたり綴りが変わったりすると、この宣言が型エラーになります。手で書き写した一覧は
 * 契約を再生成しても黙って古いままになるので、照合を型に持たせています。
 */
export const PRODUCT_SORT = {
  /** 公開日時の降順。契約の既定値。 */
  NEWEST: "-publishedAt",
  /** 公開日時の昇順。 */
  OLDEST: "publishedAt",
} as const satisfies Readonly<Record<string, WireProductQuery["sort"]>>;

/** 一覧の並び順として指定できる値。 */
type ProductSort = (typeof PRODUCT_SORT)[keyof typeof PRODUCT_SORT];

/**
 * 一度に指定できる分類の数。
 *
 * @remarks
 * 契約の宣言をそのまま持ち出しています。画面が上限を書き写すと、契約が動いたときにそこだけ
 * 古い数のまま利用者を止めます。契約は重複を許さないため、これは種類の数の上限です。
 */
export const PRODUCT_CATEGORY_LIMIT: number = getProductsQueryCategoryCodesMax;

/**
 * この面が受け付ける取得条件のスキーマ。
 *
 * @remarks
 * 分類と状態は後継の `categoryCodes` / `statusCodes` だけを受けます。契約は非推奨の
 * `categoryId` / `statusId` も残していますが、後継と同時に送ると 400 になる関係にあり、
 * 片方だけを窓口にしないと URL の書き方次第で取得そのものが落ちます。
 */
const ProductQueryParams = GetProductsQueryParams.omit({ categoryId: true, statusId: true });

/** 商品一覧の取得条件。契約のクエリと 1 対 1 に対応する。 */
export type ProductQuery = {
  after?: string;
  first?: number;
  /** 分類のコード。マスタ行を指す静的な番号で、UUID ではない。 */
  categoryCodes?: readonly number[];
  /** 状態のコード。分類と同じくマスタ行を指す静的な番号。 */
  statusCodes?: readonly number[];
  keyword?: string;
  /** 最低価格。契約が decimal 文字列で受けるため、数値へ直さず持ち回る。 */
  minPrice?: string;
  /** 最高価格。 */
  maxPrice?: string;
  /** 最低在庫数。 */
  minQuantity?: number;
  /** 最高在庫数。 */
  maxQuantity?: number;
  sort?: ProductSort;
  /**
   * 未公開の商品も母集団に含めるか。省略すると公開済みだけ。
   *
   * @remarks
   * **含める指定は管理の役割を持つ主体しか通りません。** 母集団を変えると並び順の第 1 キーも
   * 登録日時へ変わるため、ページ送りの鍵は同じ指定の中でだけ使えます。指定をまたいで持ち越した
   * 鍵は契約が 400 で返します。
   */
  includeUnpublished?: boolean;
};

/**
 * URL 由来の検索条件。
 *
 * @remarks
 * 1 つのキーに複数の値が並ぶことを許します。分類のように複数選べる条件は、区切り文字で連結
 * した 1 つの値ではなく同じキーの繰り返しで表すためです。
 */
export type RawProductQuery = Readonly<Record<string, string | readonly string[]>>;

/**
 * 契約が整数で宣言しているキー。
 *
 * @remarks
 * URL の値は常に文字列なので、そのまま渡すと整数の宣言に当たって落ちます。
 */
const INTEGER_KEYS: ReadonlySet<string> = new Set(["first", "minQuantity", "maxQuantity"]);

/**
 * 契約が整数の並びで宣言しているキー。
 *
 * @remarks
 * 1 つだけ選ばれた条件は URL に 1 回しか現れず、素の値としては単一の文字列で届きます。
 * 並びへ揃えないと、1 つ選んだときだけ契約の宣言に当たって落ちます。
 *
 * 契約はこれらを重複の無い並びとして宣言しています。同じ値が 2 度届くのは URL を直接編集した
 * ときで、指している条件は 1 度のときと同じです。畳んでから照らさないと、意味の同じ条件が
 * 契約を外れた要求として backend まで届きます。
 */
const INTEGER_ARRAY_KEYS: ReadonlySet<string> = new Set(["categoryCodes", "statusCodes"]);

/**
 * 契約が真偽値で宣言しているキー。
 *
 * @remarks
 * URL の値は常に文字列なので、そのまま渡すと真偽値の宣言に当たって落ちます。
 */
const BOOLEAN_KEYS: ReadonlySet<string> = new Set(["includeUnpublished"]);

/**
 * 契約が受け付ける綴りだけを真偽値へ直す。
 *
 * @remarks
 * **読めない綴りは文字列のまま返します。** 真偽値へ寄せると、`includeUnpublished=yes` のような
 * 打ち間違いが黙って「含めない」に倒れ、絞り込んだつもりの母集団が変わったことを利用者が
 * 知る手段がなくなります。文字列のまま契約へ落とせば、読めなかったキーとして返ります。
 */
function toBoolean(value: string): boolean | string {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}

/** 素の値を、契約が宣言した型へ直す。 */
function toTypedQuery(raw: RawProductQuery): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, toTypedValue(key, value)]),
  );
}

function toTypedValue(key: string, value: string | readonly string[]): unknown {
  if (INTEGER_ARRAY_KEYS.has(key)) {
    return [...new Set((typeof value === "string" ? [value] : value).map(Number))];
  }

  if (typeof value !== "string") {
    return value;
  }

  if (BOOLEAN_KEYS.has(key)) {
    return toBoolean(value);
  }

  return INTEGER_KEYS.has(key) ? Number(value) : value;
}

/** URL の検索条件を契約に照らした結果。 */
export type ProductQueryParseResult =
  | { readonly ok: true; readonly query: ProductQuery }
  /** 契約を外れた条件のキー。表示に使えるよう、検証ライブラリの型ではなく素の名前で返す。 */
  | { readonly ok: false; readonly invalidKeys: readonly string[] };

/**
 * URL の検索条件を、契約に照らして取得条件へ写す。
 *
 * @remarks
 * 検証をこの境界に置くのは、条件の許容範囲を決めているのが契約だからです。画面側に写すと、
 * 契約を再生成しても検証だけが古い範囲のまま残り、通ると思った値が backend で 400 になります。
 *
 * 範囲外の値を捨てて既定へ戻すことはしません。URL は利用者が直接編集できる入力であり、黙って
 * 捨てると絞り込んだつもりの一覧が絞り込まれずに出ます。写せなかったことだけを返し、どう表示
 * するかは画面側が決めます。
 *
 * 未指定のキーは契約の既定値で埋まります。件数と並び順の既定を画面ごとに決め直すと、URL を
 * 省略したときの結果が画面によって変わります。
 */
export function parseProductQuery(raw: RawProductQuery): ProductQueryParseResult {
  const parsed = ProductQueryParams.safeParse(toTypedQuery(raw));

  if (!parsed.success) {
    return {
      ok: false,
      invalidKeys: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))],
    };
  }

  return { ok: true, query: parsed.data };
}

type WireProductPage = z.infer<typeof GetProductsResponse>;
type WireProduct = WireProductPage["products"][number];

/**
 * 一致する対象を決める条件だけを、クエリ文字列の形へ写す。
 *
 * @remarks
 * 一覧と件数がどちらもこの一式を送ります。取り出す位置（`after` / `first`）と並び順は件数に
 * 効かないため含めません。片方だけに条件を足すと、出ている件数と一覧の中身が食い違います。
 */
function toFilterParams(
  query: ProductQuery,
): Record<string, string | readonly string[] | undefined> {
  return {
    // 契約は整数の並びで宣言しているが、クエリ文字列に載せる時点で文字列へ戻る。
    categoryCodes: query.categoryCodes?.map(String),
    statusCodes: query.statusCodes?.map(String),
    keyword: query.keyword,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    minQuantity: query.minQuantity?.toString(),
    maxQuantity: query.maxQuantity?.toString(),
  };
}

let client: UserScopedHttpClient | undefined;

/**
 * 商品の口を叩く client。
 *
 * @remarks
 * **資格情報は取れたときだけ載せます。**読む口は未ログインでも通り、書き込む口は主体を要求
 * します。読み書きが 1 つの client に同居するときの形と、落としたときの症状は
 * [adapters](../../README.md) の「主体を名乗るかは、口ではなく client が決める」節。
 *
 * **だからこの口の分類は `user-scoped` で、キャッシュの指定は型として渡せません**
 * （`docs/rules.md`「データ分類と機微情報」の「取得の口は分類を宣言する」）。入れてはいけない理由は
 * 同「描画とキャッシュ」の「Data Cache へ入れてよいのは主体を名乗らずに取れるものだけ」が持ちます。
 */
function getClient(): UserScopedHttpClient {
  client ??= createHttpClient({
    scope: "user-scoped",
    allowAnonymous: true,
    baseUrl: getApiConfig().baseUrl,
    getBearerToken: getAccessToken,
    maxUrlBytes: getHttpConfig().maxUrlBytes,
  });

  return client;
}

/**
 * 契約の商品を表示用の型へ写す。
 *
 * @remarks
 * 変換をこの境界に閉じるのは、契約の形が変わったときに影響が及ぶ範囲をここまでに留めるためです。
 * 生成型をそのまま内層へ渡すと、契約の都合が画面の実装へ直接漏れます。
 */
export function toProduct(wire: WireProduct): Product {
  return {
    id: toProductId(wire.id),
    name: wire.name,
    description: wire.description,
    price: wire.price,
    quantity: wire.quantity,
    stockWarningThreshold: wire.stockWarningThreshold,
    status: { id: wire.status.id, name: wire.status.name },
    category: { id: wire.category.id, name: wire.category.name },
    publishedAt: wire.publishedAt === null ? null : new Date(wire.publishedAt),
    discontinuedAt: wire.discontinuedAt === null ? null : new Date(wire.discontinuedAt),
    // 契約が displaySort 昇順で返すため、受け取った順序がそのまま表示の順序になる。
    imagePaths: wire.images.map((image) => image.imagePath),
    version: wire.version,
  };
}

/** 契約の 1 ページを表示用の型へ写す。 */
export function toProductPage(wire: WireProductPage): ProductPage {
  return {
    items: wire.products.map(toProduct),
    nextCursor: wire.nextCursor,
  };
}

/**
 * 商品一覧を取得する。
 *
 * @remarks
 * 同一レンダリング内の重複呼び出しは `cache()` がまとめます。呼び出し側に「1 回だけ呼ぶ」
 * 規律を要求すると、画面を組み替えるたびに取得の回数が変わってしまうためです。
 */
export const getProducts = cache(async (query: ProductQuery = {}): Promise<ProductPage> => {
  const page = await getClient().request({
    path: "/v1/products",
    searchParams: {
      ...toFilterParams(query),
      after: query.after,
      first: query.first?.toString(),
      sort: query.sort,
      includeUnpublished:
        query.includeUnpublished === undefined ? undefined : String(query.includeUnpublished),
    },
    schema: GetProductsResponse,
  });

  return toProductPage(page);
});

/**
 * 商品を一覧の表示データへ写す。
 *
 * @remarks
 * 画像 URL の解決をここで済ませるのは、配信元が設定から来るためです。設定を読めるのは
 * `adapters` までで、画面側は解決済みの URL しか受け取りません。
 */
function toProductListItem(product: Product): ProductListItem {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    quantity: product.quantity,
    categoryName: product.category.name,
    statusName: product.status.name,
    // 一覧は 1 件を 1 枚で表すため先頭を採る。どれを代表とするかは契約の順序が決めている。
    imageUrl: resolveMediaUrl(product.imagePaths[0] ?? null),
  };
}

/**
 * 商品一覧を、表示に必要なものだけへ絞った 1 ページとして取得する。
 *
 * @remarks
 * 増分取得が同じ形を JSON で受け取るため、`Date` や省略可能な値を含まない形へここで落とします。
 * 初回ページと増分ページで形が違うと、積み上げた一覧の途中から表示が壊れます。
 */
export async function getProductListPage(
  query: ProductQuery = {},
): Promise<CursorPage<ProductListItem>> {
  const page = await getProducts(query);

  return { items: page.items.map(toProductListItem), nextCursor: page.nextCursor };
}

/**
 * 条件に一致する商品の総数を取得する。
 *
 * @remarks
 * cursor ページネーションは総数を持たないため、一覧の応答からは取り出せません。
 * 総数はこの取得口だけが返します。
 *
 * 一覧と同じ条件を受け取ります。条件を渡さない口にすると、絞り込んだ後も絞り込む前の数が出て、
 * 一覧に並んでいる件数と食い違います。
 */
export const getProductCount = cache(async (query: ProductQuery = {}): Promise<number> => {
  const { count } = await getClient().request({
    path: "/v1/products/count",
    searchParams: toFilterParams(query),
    schema: GetProductsCountResponse,
  });

  return count;
});

/** 売れ筋ランキングの取得条件。 */
export type ProductRankingQuery = {
  /** 集計対象の区間。省略すると全期間。 */
  readonly window?: TimeWindow;
  /** 取得する上位の件数。 */
  readonly limit?: number;
};

/**
 * 売れ筋ランキングを取得する。
 *
 * @remarks
 * **数量の軸です。** 契約は数量順と金額順を別の口に分けており、こちらが返すのは販売数量の降順
 * です。金額順が要る画面が現れたときは、この口を切り替えるのではなく口をもう 1 つ足します。
 * どちらを見ているかが呼び出し側から読み取れなくなるためです。
 *
 * キャッシュを指定していません。ランキングは購入が発生するたびに変わる集計値であり、
 * 無効化の引き金になるのは商品の更新ではなく購入です。商品のタグへ相乗りさせると、
 * 商品を触らない限り古い集計が残り続けます。
 *
 * 件数と期間を既定へ寄せず呼び出し側から受けるのは、画面ごとに要る件数が違うためです。
 * 省略時は契約の既定値（全期間・上位 10 件）が効きます。
 */
export const getProductRanking = cache(
  async ({
    window = WHOLE_TIME,
    limit,
  }: ProductRankingQuery = {}): Promise<readonly ProductRankingEntry[]> => {
    const response = await getClient().request({
      path: "/v1/products/ranking/quantity",
      searchParams: {
        orderedAfter: window.after,
        orderedBefore: window.before,
        limit: limit?.toString(),
      },
      schema: GetProductsRankingQuantityResponse,
    });

    return response.rankings.map((entry) => ({
      productId: toProductId(entry.productId),
      name: entry.name,
      price: entry.price,
      soldQuantity: entry.soldQuantity,
    }));
  },
);

/**
 * 商品 1 件を取得する。
 *
 * @remarks
 * 一覧と同じ経路を通すため、生 status の分類と応答の検証は fetch wrapper が済ませています。
 * 存在しない ID は wrapper が `not-found` へ正規化するため、ここでは分岐を持ちません。
 */
export const getProduct = cache(async (id: ProductId): Promise<Product> => {
  const product = await getClient().request({
    path: `/v1/products/${encodeURIComponent(id)}`,
    schema: GetProductsDetailResponse,
  });

  return toProduct(product);
});

/** 画像 1 件を契約の形へ写す。 */
function toWireImage(image: ProductImageDraft) {
  return { imagePath: image.imagePath, displaySort: image.displaySort };
}

/** 公開日時を契約の形へ写す。未公開は null のまま送る。 */
function toWirePublishedAt(publishedAt: Date | null): string | null {
  return publishedAt === null ? null : publishedAt.toISOString();
}

/**
 * 画像を 1 件アップロードし、保存されたオブジェクトキーを返す。
 *
 * @remarks
 * 受け口が multipart しか持たないため、この経路を通します。**再送しません** —— 同じ本文を
 * 二度送れば別のキーで二重に保存され、片方が誰からも参照されないまま残ります。
 *
 * 返るのはキーだけで、表示 URL はここでは組みません。組み立てに要る配信元は表示側の関心です。
 */
export async function uploadProductImage(image: File): Promise<string> {
  const body = new FormData();
  body.append("image", image);

  const { imagePath } = await getClient().request({
    path: "/v1/products/images",
    method: "POST",
    multipart: body,
    schema: PostProductsImagesResponse,
  });

  return imagePath;
}

/**
 * 商品を作る。
 *
 * @remarks
 * 自然キーを持たないため**再送しません**。同じ本文を二度送れば商品が 2 件できます。
 */
export async function createProduct(draft: ProductDraft): Promise<Product> {
  const wire = await getClient().request({
    path: "/v1/products",
    method: "POST",
    body: {
      name: draft.name,
      description: draft.description,
      price: draft.price,
      quantity: draft.quantity,
      stockWarningThreshold: draft.stockWarningThreshold,
      categoryId: draft.categoryId,
      statusId: draft.statusId,
      publishedAt: toWirePublishedAt(draft.publishedAt),
      images: draft.images.map(toWireImage),
    } satisfies ProductsPostRequest,
    schema: PostProductsResponse,
  });

  return toProduct(wire);
}

/**
 * 商品を更新する。
 *
 * @remarks
 * 在庫数を送りません。在庫は加算で動かす別の口が持ちます。
 *
 * 画像は**集合ごと置き換わります**。差分ではないため、残したい画像も併せて送ります。
 *
 * 版が現在値と食い違えば wrapper が `conflict` へ正規化します。呼び出し側はそれを、取り直して
 * から送り直す合図として扱います。
 */
export async function updateProduct(id: ProductId, edit: ProductEdit): Promise<Product> {
  const wire = await getClient().request({
    path: `/v1/products/${encodeURIComponent(id)}`,
    method: "PATCH",
    body: {
      version: edit.version,
      name: edit.name,
      description: edit.description,
      price: edit.price,
      stockWarningThreshold: edit.stockWarningThreshold,
      categoryId: edit.categoryId,
      statusId: edit.statusId,
      publishedAt: toWirePublishedAt(edit.publishedAt),
      images: edit.images.map(toWireImage),
    } satisfies ProductPatchRequest,
    schema: PatchProductsDetailResponse,
  });

  return toProduct(wire);
}

/**
 * 在庫を増減する。
 *
 * @remarks
 * 送るのは**増減量であって、更新後の在庫数ではありません**。契約が相対値を受け取るため、読んだ
 * 時点から送るまでの間に売れた分・別の主体が補充した分は打ち消されず、合成されます。
 *
 * 版を添えません。相対更新は並行しても失われないため、競合を検出して拒む必要がそもそも
 * ありません（{@link updateProduct} との違いはここです）。
 *
 * **再送しません。** 同じ増減量を二度送れば二度加算されます。自然キーを持たない加算であり、
 * 応答が返らなかったときに成立したかどうかは、取り直して確かめる以外にありません。
 *
 * 増減後の在庫が保持できる範囲を外れる要求は、wrapper が `validation` へ正規化します。
 *
 * @param id - 対象の商品
 * @param delta - 増減量。正で補充、負で差し引き
 * @returns 増減後の商品
 */
export async function adjustProductStock(id: ProductId, delta: number): Promise<Product> {
  const wire = await getClient().request({
    path: `/v1/products/${encodeURIComponent(id)}/stock`,
    method: "PATCH",
    body: { delta } satisfies ProductStockPatchRequest,
    schema: PatchProductsStockResponse,
  });

  return toProduct(wire);
}

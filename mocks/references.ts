import type { DrawFromEndpoint, ReferencePatches } from "./stable-responses";

/**
 * 契約が持つ相互参照と、題材そのものの値の表。
 *
 * @remarks
 * 契約から生成した応答は口ごとに独立しているため、商品が名乗る分類・状態の識別子が、それらを
 * 一覧する口の応答に**存在しません**。画面は選択肢に無い値を「選べない」として扱うので、参照の
 * 整合をここで取ります。
 *
 * **組ごと差し替えます。** 購入ステータスは `id` と業務キーと名称を 1 つの object で持ちます。
 * 項目ごとの指定では組が壊れる（`id` と業務キーを別々に引くことになる）ためです。
 *
 * **噛み合っていなければならない値も同じ理由でここに来ます。** 商品名と分類は互いを指しませんが、
 * 別々に決めると「Tシャツの分類が書籍」になります。生成器は項目を 1 つずつ作るので、組で決まる値を
 * 表せません。
 *
 * **契約ごとの知識なので、機構（`stable-responses.ts`）ではなくこちらが持ちます。** テンプレートから
 * 作った側は自分の契約の参照をこの表に書き、この題材ごと破棄します。
 */

/** 分類マスタの口。seed は要求の URL から決まるので、画面が叩くのと同じ綴りを使う。 */
const CATEGORIES_PATH = "/v1/products/categories";

/** 状態マスタの口。 */
const STATUSES_PATH = "/v1/products/statuses";

/** 購入ステータスマスタの口。 */
const PURCHASE_STATUSES_PATH = "/v1/purchases/statuses";

/** マスタが返す 1 件。識別子と表示名だけを見る。 */
type MasterEntry = { readonly id: string; readonly name: string };

/**
 * 題材の商品。
 *
 * @remarks
 * 分類は名前と噛み合う 1 件を名指します。生成器の既定は 255 文字までのランダム英字で、名前の列が
 * 表の幅を独り占めするため、実在しうる長さでもあります。
 */
const PRODUCT_CATALOGUE = [
  { name: "ワイヤレスイヤホン", categoryName: "家電" },
  { name: "全自動コーヒーメーカー ステンレスサーバー付き", categoryName: "家電" },
  { name: "デスクライト 調光調色", categoryName: "家電" },
  { name: "アロマディフューザー 超音波式", categoryName: "家電" },
  { name: "オーガニックコットン クルーネックTシャツ", categoryName: "衣類" },
  { name: "ランニングシューズ 軽量クッション", categoryName: "衣類" },
  { name: "文庫本カバー 帆布", categoryName: "書籍" },
  { name: "ドリップコーヒー 中煎り 200g", categoryName: "食品" },
  { name: "ステンレス保温マグ 480ml", categoryName: "日用品" },
  { name: "折りたたみ傘 自動開閉 軽量", categoryName: "日用品" },
  { name: "詰め替え用ハンドソープ 800ml", categoryName: "日用品" },
];

/** 応答から、マスタの一覧として読める配列を取り出す。 */
function entriesOf(response: unknown): readonly MasterEntry[] {
  if (!Array.isArray(response)) {
    throw new TypeError("マスタの応答が一覧ではありません");
  }

  return response as readonly MasterEntry[];
}

/**
 * 一覧から 1 件を選ぶ。
 *
 * @remarks
 * どの 1 件を選ぶかは、いま入っている識別子から決めます。要求ごとに同じ結果へ落ちる必要があり、
 * かつ商品ごとに違う分類が付いてほしいためです。
 *
 * `shift` は並びの中での位置です。同じ組の中で選び先を重ねたくないとき（1 つの注文の明細など）に
 * 渡します。
 */
function pick<T>(entries: readonly T[], current: unknown, shift = 0): T {
  const [first] = entries;

  if (first === undefined) {
    throw new Error("マスタの一覧が空です");
  }

  const key = typeof current === "string" ? current : "";
  const offset = [...key].reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return entries[(offset + shift) % entries.length] ?? first;
}

/** object として読めない応答を弾く。 */
function recordOf(response: unknown, subject: string): Record<string, unknown> {
  if (typeof response !== "object" || response === null) {
    throw new TypeError(`${subject}の応答が object ではありません`);
  }

  return response as Record<string, unknown>;
}

/** 応答が持つ配列を取り出す。 */
function arrayOf(record: Record<string, unknown>, key: string, subject: string): unknown[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new TypeError(`${subject}の応答が ${key} の配列を持ちません`);
  }

  return value;
}

/** object の `id` を読む。差し替えの選び先を決める鍵にする。 */
function idOf(value: unknown): unknown {
  return (value as Record<string, unknown> | null)?.["id"];
}

/** 商品 1 件の名前・分類・状態を、噛み合う組へ揃える。 */
function alignProduct(product: unknown, draw: DrawFromEndpoint): unknown {
  const record = recordOf(product, "商品");

  if (!("category" in record) || !("status" in record)) {
    throw new Error("商品の応答が分類または状態を持ちません");
  }

  const categories = entriesOf(draw("getGetProductCategoriesResponseMock", CATEGORIES_PATH));
  const statuses = entriesOf(draw("getGetProductStatusesResponseMock", STATUSES_PATH));
  const catalogued = pick(PRODUCT_CATALOGUE, record["id"]);
  const category = categories.find((entry) => entry.name === catalogued.categoryName);

  if (category === undefined) {
    throw new Error(`分類マスタに ${catalogued.categoryName} がありません`);
  }

  return {
    ...record,
    name: catalogued.name,
    category,
    status: pick(statuses, idOf(record["status"])),
  };
}

/** 一覧の応答に含まれる商品を、1 件ずつ揃える。 */
function alignProductList(response: unknown, draw: DrawFromEndpoint): unknown {
  const record = recordOf(response, "一覧");

  return {
    ...record,
    products: arrayOf(record, "products", "一覧").map((product) => alignProduct(product, draw)),
  };
}

/** ランキングが並べる商品名を、題材の名前へ揃える。 */
function alignProductRanking(response: unknown): unknown {
  const record = recordOf(response, "ランキング");

  return {
    ...record,
    rankings: arrayOf(record, "rankings", "ランキング").map((entry) => {
      const ranked = recordOf(entry, "ランキングの行");

      return { ...ranked, name: pick(PRODUCT_CATALOGUE, ranked["productId"]).name };
    }),
  };
}

/**
 * 購入 1 件のステータスと、明細が名乗る商品名を揃える。
 *
 * @remarks
 * 明細を持つのは購入詳細だけで、一覧の行や遷移の応答は持ちません。持っている応答にだけ触れます。
 */
function alignPurchase(purchase: unknown, draw: DrawFromEndpoint): Record<string, unknown> {
  const record = recordOf(purchase, "購入");

  if (!("status" in record)) {
    throw new Error("購入の応答がステータスを持ちません");
  }

  const details = record["details"];
  const named = Array.isArray(details)
    ? details.map((detail, index) => {
        const line = recordOf(detail, "購入の明細");

        // 位置でずらします。明細ごとに識別子から引くと同じ商品が 1 つの注文に何度も並びます。
        return "productName" in line
          ? { ...line, productName: pick(PRODUCT_CATALOGUE, record["code"], index).name }
          : line;
      })
    : undefined;

  const statuses = entriesOf(draw("getGetPurchaseStatusesResponseMock", PURCHASE_STATUSES_PATH));

  return {
    ...record,
    ...(named === undefined ? {} : { details: named }),
    status: pick(statuses, idOf(record["status"])),
  };
}

/** 一覧の応答に含まれる購入を、1 件ずつ揃える。 */
function alignPurchaseList(response: unknown, draw: DrawFromEndpoint): unknown {
  const record = recordOf(response, "購入一覧");

  return {
    ...record,
    items: arrayOf(record, "items", "購入一覧").map((purchase) => {
      const line = recordOf(purchase, "購入一覧の行");

      return {
        ...alignPurchase(line, draw),
        firstItemName: pick(PRODUCT_CATALOGUE, line["code"]).name,
      };
    }),
  };
}

/**
 * ステータスごとの内訳を、重複しないステータスへ揃える。
 *
 * @remarks
 * 並びの位置で選び、**ステータスの数を超える行は落とします**。識別子から選ぶと同じステータスが
 * 2 行に出ますが、位置で選んでも一周すれば同じことが起きます。内訳の行数はステータスの数を
 * 超えられません。
 */
function alignStatusBreakdown(key: string) {
  return (response: unknown, draw: DrawFromEndpoint): unknown => {
    const record = recordOf(response, "内訳");
    const statuses = entriesOf(draw("getGetPurchaseStatusesResponseMock", PURCHASE_STATUSES_PATH));

    return {
      ...record,
      [key]: arrayOf(record, key, "内訳")
        .slice(0, statuses.length)
        .map((entry, index) => ({
          ...recordOf(entry, "内訳の行"),
          status: statuses[index],
        })),
    };
  };
}

/**
 * 口をまたいで指し合う項目と、組で決まる値を揃える表。
 *
 * @remarks
 * **項目が消えたら落とします。** 契約が変わって参照の項目が無くなったとき、黙って整合が外れると
 * 今と同じ状態（選択肢に無い値が入った画面）へ戻ります。落ちれば、契約に追随して表を直す契機に
 * なります。
 */
export const REFERENCE_PATCHES: ReferencePatches = new Map([
  ["getGetProductsResponseMock", alignProductList],
  ["getGetProductsLowStockResponseMock", alignProductList],
  ["getGetProductsDetailResponseMock", alignProduct],
  ["getPostProductsResponseMock", alignProduct],
  ["getPatchProductsDetailResponseMock", alignProduct],
  ["getPatchProductsStockResponseMock", alignProduct],
  ["getGetProductsRankingQuantityResponseMock", alignProductRanking],
  ["getGetProductsRankingAmountResponseMock", alignProductRanking],
  ["getGetPurchasesResponseMock", alignPurchaseList],
  ["getGetPurchasesDetailResponseMock", alignPurchase],
  ["getPatchPurchasesCancelResponseMock", alignPurchase],
  ["getPatchPurchasesPayResponseMock", alignPurchase],
  ["getPatchPurchasesShipResponseMock", alignPurchase],
  ["getPatchPurchasesDeliverResponseMock", alignPurchase],
  ["getGetUsersMePurchasesSummaryResponseMock", alignStatusBreakdown("statusBreakdown")],
  ["getGetDashboardSummaryResponseMock", alignStatusBreakdown("purchaseStatusCounts")],
]);

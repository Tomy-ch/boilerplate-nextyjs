import type { RequestHandler } from "msw";

// sample:replace-begin
import { HttpResponse, http } from "msw";
import { ADDRESS_CANDIDATES, SINGLE_ADDRESS_CANDIDATE } from "@/features/account/account.fixture";
import { LOADED_ENTRIES } from "@/features/purchases/purchases.fixture";
import type { AddressCandidate } from "@/model/user/user";
import { SAMPLE_ITEM_URLS } from "../lib/sample-asset";

/**
 * カタログで引ける郵便番号。
 *
 * @remarks
 * 宣言に無い番号は候補なしで返します。外部の lookup が引けなかったときと同じ応答で、契約が
 * そう定めています（`200` と空の候補）。
 */
const ADDRESS_BY_POSTAL_CODE: Readonly<Record<string, readonly AddressCandidate[]>> = {
  /** 町域が割れる。都道府県と市区町村だけが埋まる。 */
  "150-0001": ADDRESS_CANDIDATES,
  /** 町域まで 1 つに定まる。丁目・番地が空なら町域まで埋まる。 */
  "220-0012": SINGLE_ADDRESS_CANDIDATE,
};

/**
 * lookup の機構が動いていないことにする郵便番号。
 *
 * @remarks
 * 該当なしと別に置きます。契約は両者を `isFallback` で分けており、画面が言うことも変わる
 * （手入力へ倒す）ので、カタログでも別々に踏めなければ確かめられません。
 */
const UNAVAILABLE_POSTAL_CODE = "000-0000";

/** 確定前の条件で数えた件数。どの条件でも同じ数を返す。 */
const FILTERED_COUNT = 42;

/**
 * 読み進めた先で届く一覧。
 *
 * @remarks
 * **続きを持たせません**（`nextCursor` は `null`）。カタログの一覧は 4〜5 件しか置かないので
 * 末尾の目印が最初から見えており、続きを持たせると届いた先でまた末尾が見えて、際限なく取りに
 * 行きます。DOM が静止しないので基準画像も撮れません。
 */
const NEXT_PRODUCT_PAGE = Array.from({ length: 4 }, (_, index) => ({
  id: `0195f0c2-0000-7000-8000-0000002000${String(index).padStart(2, "0")}`,
  name: `続きの商品 ${index + 1}`,
  price: "24.00",
  quantity: 6,
  categoryName: "アクセサリ",
  statusName: "公開",
  imageUrl: index % 2 === 0 ? SAMPLE_ITEM_URLS[1] : null,
}));

/** 読み進めた先で届く購入履歴。続きを持たせない理由は {@link NEXT_PRODUCT_PAGE} と同じ。 */
const NEXT_PURCHASE_PAGE = LOADED_ENTRIES.slice(4, 8);
// sample:replace-with
// sample:replace-end

/**
 * カタログが自分で答える `/api/*` の口。
 *
 * @remarks
 * 返すのは Route Handler が組み立てる表示用の形で、契約からの生成物ではありません（置き場を
 * [mocks](../../mocks/README.md) と分けているのはこのためです）。形は `adapters/client` が
 * 検証しており、ずれた応答は部品が失敗の見え方へ落ちる形で現れます。
 */
// sample:replace-begin
export const handlers: readonly RequestHandler[] = [
  http.get("/api/addresses", ({ request }) => {
    const postalCode = new URL(request.url).searchParams.get("postalCode") ?? "";

    return HttpResponse.json({
      candidates: ADDRESS_BY_POSTAL_CODE[postalCode] ?? [],
      isFallback: postalCode === UNAVAILABLE_POSTAL_CODE,
    });
  }),
  http.get("/api/products/count", () => HttpResponse.json({ count: FILTERED_COUNT })),
  http.get("/api/products", () =>
    HttpResponse.json({ items: NEXT_PRODUCT_PAGE, nextCursor: null }),
  ),
  http.get("/api/purchases", () =>
    HttpResponse.json({ items: NEXT_PURCHASE_PAGE, nextCursor: null }),
  ),
];
// sample:replace-with
// = export const handlers: readonly RequestHandler[] = [];
// sample:replace-end

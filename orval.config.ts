import { faker } from "@faker-js/faker";
import { defineConfig } from "orval";

// 契約に載っているが本アプリが呼ばない operation の tag。
//
// health 系と /metrics は運用基盤が叩くものでフロントの接続先ではない。
const NON_CLIENT_TAGS = [
  "health",
  "healthz",
  "metrics",
  "ready",
  "version",
  // sample:begin
  // ErrorResponse 型を生成させるためだけの擬似エンドポイントで、呼び出し先としては存在しない。
  // 除外しても ErrorResponse 自体は各 operation の異常系レスポンスから参照されるため生成される。
  "internal/types/error-response",
  // sample:end
];

// pattern を持つ項目の値の作り方。
//
// orval は pattern を見つけると `faker.helpers.fromRegExp(パターン)` を出すが、この API は
// `\d` のような短縮クラスもアンカーも解釈せず、パターンの文字列をほぼそのまま返す
// (`^\d+(\.\d+)?$` → `^\dd(\.\d)?$`)。結果としてモックが、同じ契約から生成した zod 検証を
// 通らない。
//
// sample:replace-begin
// 契約に pattern を持つ項目が増えたときの取りこぼしは、全ハンドラの応答を対応する zod で
// 検証するテスト (`mocks/contract-conformance.test.ts`) が捕まえる。
// sample:replace-with
// = // 取りこぼしは黙って通る。生成物と zod はどちらも契約から出るので、両者を突き合わせる検査を
// = // 契約を入れたときに書く (`mocks/README.md` の「契約適合の検査」)。
// sample:replace-end
const PATTERNED_MOCK_PROPERTIES = {
  // sample:replace-begin
  // USD の decimal 文字列。サブセント精度を保つため数値ではなく文字列で表される。
  //
  // `amount` は入れない。参考換算額の中の `amount` は最小単位の整数であり、decimal 文字列を
  // 与えると契約に反する。
  "/^(price|unitPrice|rate|original)$/": () => "19.99",
  // 符号付きの decimal 文字列。
  "/^converted$/": () => "-19.99",
  // 先頭の + は任意で、以降は 10〜15 桁の数字。
  "/^phone$/": () => "09012345678",
  "/^postalCode$/": () => "100-0001",
  // 住所は pattern を持たないが、faker の既定は 10〜100 文字のランダム英字を返す。実在しない
  // 地名では、選択部品の幅も住所 1 行の折り返しも実物と違う姿で確かめることになる。
  // `prefectureName` も同じ選択部品へ入る。郵便番号の補完が返す県名が一覧に無い綴りだと、
  // 部品は選べない値として扱い、利用者が触っていないのに検証エラーが出る。
  "/^(prefecture|prefectureName)$/": () => "神奈川県",
  "/^city$/": () => "横浜市西区",
  // sample:replace-with
  // = // 書き方は `"/^<項目名>$/": () => <値>` で、キーは文字列に入れた正規表現、値はその項目の
  // = // 値を返す関数。
  // = //
  // = // **空で始まるのは、下の値域と違って「どの契約でも妥当な既定」が無いためである。** 値域は
  // = // 桁数の話なので件数や頁の大きさに普遍的な範囲を置けるが、pattern は項目名も書式も契約ごと
  // = // に違い、書き写した値は次の契約では zod を通らない。
  // sample:replace-end
};

// sample:begin
/**
 * 商品状態マスタのモック応答。
 *
 * @remarks
 * **`code` は画面が読む業務キーです。** 一覧のバッジの色はこの値で決まる
 * （`src/features/admin/products/list/status-tone.ts`）ので、生成器の既定（32bit の乱数）では
 * どの商品も既定色になり、色の出し分けを一度も確かめられません。
 *
 * 契約は値域を宣言していないため、生成器には本物を出す手がかりがありません。ここに書いた値が
 * 実データと一致していることの保証はこの宣言だけで、**出所はバックエンドではありません**。
 */
const PRODUCT_STATUSES = [
  { id: "0195f0c2-1000-7000-9000-000000000001", code: 1, name: "在庫あり" },
  { id: "0195f0c2-1000-7000-9000-000000000002", code: 2, name: "在庫切れ" },
  { id: "0195f0c2-1000-7000-9000-000000000003", code: 3, name: "予約受付中" },
  { id: "0195f0c2-1000-7000-9000-000000000004", code: 4, name: "販売終了" },
  { id: "0195f0c2-1000-7000-9000-000000000005", code: 5, name: "取り寄せ中" },
  { id: "0195f0c2-1000-7000-9000-000000000006", code: 6, name: "入荷待ち" },
  { id: "0195f0c2-1000-7000-9000-000000000007", code: 7, name: "廃盤" },
  { id: "0195f0c2-1000-7000-9000-000000000008", code: 8, name: "検討中" },
  { id: "0195f0c2-1000-7000-9000-000000000009", code: 9, name: "再入荷予定" },
  { id: "0195f0c2-1000-7000-9000-000000000010", code: 10, name: "限定販売" },
];

/**
 * 商品分類マスタのモック応答。
 *
 * @remarks
 * 名前が乱数の英字列だと、選択部品の幅も一覧の折り返しも実物と違う姿で確かめることになります
 * （都道府県と同じ理由）。`code` は絞り込みのクエリに載る業務キーです。
 */
const PRODUCT_CATEGORIES = [
  { id: "0195f0c2-2000-7000-9000-000000000001", code: 1, name: "家電" },
  { id: "0195f0c2-2000-7000-9000-000000000002", code: 2, name: "食品" },
  { id: "0195f0c2-2000-7000-9000-000000000003", code: 3, name: "衣類" },
  { id: "0195f0c2-2000-7000-9000-000000000004", code: 4, name: "書籍" },
  { id: "0195f0c2-2000-7000-9000-000000000005", code: 5, name: "日用品" },
];

/**
 * 購入ステータスマスタのモック応答。
 *
 * @remarks
 * **`code` は画面が読む業務キーです。** バッジの見た目
 * （`src/features/purchases/facade/status-emphasis/status-emphasis.ts`）も、詳細に出せる操作
 * （`src/features/purchases/detail/available-transitions.ts`）もこの値で決まるので、生成器の既定
 * （乱数）ではどの購入も既定へ倒れ、操作が 1 つも出ません。
 *
 * 契約は値域を宣言していないため、生成器には本物を出す手がかりがありません。ここに書いた値が
 * アプリ側の転記（`src/model/purchase/purchase-status.ts`）と一致していることは
 * `mocks/contract-conformance.test.ts` が見ます。
 */
const PURCHASE_STATUSES = [
  { code: 1, name: "未処理" },
  { code: 2, name: "受付中" },
  { code: 3, name: "確認中" },
  { code: 4, name: "処理中" },
  { code: 5, name: "完了" },
  { code: 6, name: "キャンセル" },
  { code: 7, name: "支払い済み" },
  { code: 8, name: "発送済み" },
  { code: 9, name: "配達済み" },
].map(({ code, name }) => ({
  id: `0195f0c2-4000-7000-9000-${String(code).padStart(12, "0")}`,
  code,
  name,
}));

/**
 * 都道府県マスタのモック応答。
 *
 * @remarks
 * この operation だけ応答そのものを差し替えます。項目名が汎用の `name` なので、上の
 * 項目名による指定では商品名や状態名まで巻き込みます。
 *
 * 全 47 件は置かず、地方の散った 11 件に絞ります。`code` は JIS X 0401 の実際の値であり、
 * 連番ではありません。**間引いても選択部品の幅は変わりません** —— 47 件の最長は 4 文字で、
 * 残す中の神奈川県が同じ 4 文字だからです。
 *
 * 契約は件数もコード体系も宣言していないため、生成器には本物を出す手がかりがありません。
 * ここに書いた値が実データと一致していることの保証はこの宣言だけで、**出所はバックエンドでは
 * ありません**。
 */
const PREFECTURES = [
  { code: 1, name: "北海道" },
  { code: 4, name: "宮城県" },
  { code: 13, name: "東京都" },
  { code: 14, name: "神奈川県" },
  { code: 23, name: "愛知県" },
  { code: 26, name: "京都府" },
  { code: 27, name: "大阪府" },
  { code: 34, name: "広島県" },
  { code: 38, name: "愛媛県" },
  { code: 40, name: "福岡県" },
  { code: 47, name: "沖縄県" },
].map(({ code, name }) => ({
  id: `0195f0c2-0000-7000-8000-${String(code).padStart(12, "0")}`,
  code,
  name,
}));

// sample:end

// sample:replace-begin
/**
 * 数の項目の値域。
 *
 * @remarks
 * 契約は件数にも金額にも上下限を宣言しないため、生成器は 16 桁の整数を返します。集計の指標は
 * カードの幅に収まらず途中で切れ、在庫は表の列を押し広げます。**値が切れている画面では、その
 * カードや列の姿を確かめられません。**
 *
 * 金額は USD のセント単位の整数です（`DashboardSummaryResponse`）。税と送料に小さい範囲を別に
 * 与えるのは、同じ範囲から独立に引くと送料が小計を超えるためです。
 *
 * ここに書いた範囲は契約から読める値ではありません。実在しうる桁数を与えるためだけのものです。
 */
// sample:replace-with
// = /**
// =  * 数の項目の値域。
// =  *
// =  * @remarks
// =  * 上下限の無い整数を契約が宣言すると、生成器は 16 桁の値を返します。集計の指標はカードの幅に
// =  * 収まらず途中で切れ、件数は表の列を押し広げます。**値が切れている画面では、そのカードや列の
// =  * 姿を確かめられません。**
// =  *
// =  * 組で決まる値（税と送料のように、独立に引くと大小が逆転するもの）はここでは表せません。
// =  * 項目ごとに引かれるため、`operations` の側で応答ごと指定します。
// =  *
// =  * ここに書いた範囲は契約から読める値ではありません。実在しうる桁数を与えるためだけのものです。
// =  */
// sample:replace-end
const NUMBER_RANGE_MOCK_PROPERTIES = {
  // sample:begin
  "/^(quantity|soldQuantity|availableQuantity)$/": () => faker.number.int({ min: 0, max: 99 }),
  "/^stockWarningThreshold$/": () => faker.number.int({ min: 1, max: 20 }),
  // sample:end
  "/^version$/": () => faker.number.int({ min: 1, max: 20 }),
  // 頁繰りの件数。一覧の表示件数と桁が揃っていないと、頁送りの見た目を確かめられない。
  // sample:replace-begin
  "/^(count|itemCount|total|totalCount|salesCount|totalProductCount|publishedProductCount)$/": () =>
    faker.number.int({ min: 0, max: 9999 }),
  // sample:replace-with
  // = "/^(count|itemCount|total|totalCount)$/": () => faker.number.int({ min: 0, max: 9999 }),
  // sample:replace-end
  "/^limit$/": () => faker.number.int({ min: 10, max: 50 }),
  "/^offset$/": () => faker.number.int({ min: 0, max: 100 }),
  // sample:begin
  "/^shippingFee$/": () => faker.number.int({ min: 0, max: 2000 }),
  "/^taxAmount$/": () => faker.number.int({ min: 0, max: 99_999 }),
  "/^(amount|subtotalAmount|totalAmount)$/": () => faker.number.int({ min: 1000, max: 999_999 }),
  // 期間の売上合計。1 日あたり $1,000〜$9,999 にあたる。
  // 商品売上ランキングの同名の項目は decimal 文字列で宣言されており、そちらは operation の指定が勝つ。
  "/^salesAmount$/": () => faker.number.int({ min: 100_000, max: 999_999 }),
  // sample:end
};

// 取得物と生成物の置き場。**綴りの `api` は `openapi/sources.yaml` の `name` と揃える**
// （同じ綴りが `scripts/openapi/gen-api-plan.ts` の `GEN_API_OUTPUTS` にも入る）。ここだけ
// 動かしても型検査も lint も通り、`make gen-api-check` が「生成物がありません」という別の顔で
// 落ちる —— そこが指す `make gen-api` を何度回しても直らない。
const apiInput = {
  target: "./openapi/api.gen.yaml",
  filters: { mode: "exclude" as const, tags: NON_CLIENT_TAGS },
};

export default defineConfig({
  // wire 型は src/adapters/gen/ に、HTTP client は mocks/ に置く。orval は client の出力先
  // (target) を必須とする一方、outbound の resilience は adapters の手書き wrapper が所有する
  // ため、生成された client は使わない。
  // 本番が参照する場所へ置くと「どちらで呼ぶのか」が生成物の側から曖昧になる。
  // 孤児の始末は orval の clean ではなく `make gen-api` が持つ。あちらは生成の直前に置き場を
  // まるごと消すので、mode や target の置き方に依らず「契約に無いものは残らない」が成り立つ。
  // project ごとの clean だと、単一ファイルへ出す zod 側には付けられない —— その target の
  // ディレクトリが契約ごとの共有階層 (`src/adapters/gen/<契約名>/`) で、同階層の model/ ごと
  // 消してしまうためである。置き場の都合が出力の形を縛らないよう、責任を 1 段外へ出してある。
  api: {
    input: apiInput,
    output: {
      client: "fetch",
      mode: "split",
      target: "./mocks/api/endpoints.ts",
      schemas: "./src/adapters/gen/api/model",
      mock: { generators: [{ type: "msw" }] },
      override: {
        mock: { properties: { ...PATTERNED_MOCK_PROPERTIES, ...NUMBER_RANGE_MOCK_PROPERTIES } },
        // sample:replace-begin
        operations: {
          GetPrefectures: { mock: { data: PREFECTURES } },
          GetProductStatuses: { mock: { data: PRODUCT_STATUSES } },
          GetProductCategories: { mock: { data: PRODUCT_CATEGORIES } },
          GetPurchaseStatuses: { mock: { data: PURCHASE_STATUSES } },
          // 売上額は decimal 文字列だが、同じ項目名がダッシュボードの集計では整数で宣言されて
          // いる。項目名で指定すると整数のほうまで文字列に変わるため、この operation に閉じる。
          GetProductsRankingAmount: {
            mock: { properties: { "/^salesAmount$/": () => "824.69" } },
          },
        },
        // sample:replace-with
        // = // 組で決まる値（`id` と業務キーと名称が揃っていなければならないもの）と、同じ項目名が
        // = // 口によって別の型で宣言されている場合は、ここで operation ごとに指定する。項目名による
        // = // 指定は口をまたいで効くため、片方に合わせるともう片方が契約に反する。
        // = operations: {},
        // sample:replace-end
      },
    },
  },
  apiZod: {
    input: apiInput,
    output: {
      client: "zod",
      mode: "single",
      target: "./src/adapters/gen/api/endpoints.zod.ts",
    },
  },
});

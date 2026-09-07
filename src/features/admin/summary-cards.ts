import type { DashboardSummary } from "@/model/dashboard/dashboard";
import { formatMoney } from "@/model/money";
import { formatCount } from "./count";
import { ADMIN_PRODUCT_LIST_PATH } from "./paths";

/**
 * 数値カード 1 枚分。
 *
 * @remarks
 * 値は整形済みの文字列で持ちます。桁区切りや通貨記号の付け方を表示側に配ると、同じ集計が
 * 置き場所ごとに違う顔で出ます。
 */
export type SummaryCard = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /**
   * 何を数えた値かを添える一文。
   *
   * @remarks
   * **省略できません。** 3 つの指標は母集団が違い（`model/dashboard`）、注記が無いと読み手は
   * 同じ期間の同じ母集団だと読みます。
   */
  readonly note: string;
  /**
   * その数の中身を並べた面。無ければ押せない。
   *
   * @remarks
   * **数と行き先の母集団が一致するものだけが持ちます。** 押した先の件数が数と違うと、どちらかが
   * 誤っているように読めます。一致する一覧が契約に無い数は、押せないままにしてあります。
   */
  readonly href?: string;
  /** 押せるときの読み上げ名。見えている見出しを含める。 */
  readonly linkLabel?: string;
};

/**
 * 集計を数値カードの並びへ写す。
 *
 * @remarks
 * 並びは「期間で動く 2 枚 → 期間で動かない 2 枚」の順です。同じ枠に並ぶ数のうち、どれが選んだ
 * 期間に反応するのかが位置で読めます。
 *
 * 合計や割合を作りません。足し合わせてよい組み合わせがこの中に無いためで、画面が作れる数は
 * バックエンドが返していない数です。
 *
 * 行き先を添える条件は {@link SummaryCard.href} の契約に従います。
 */
export function toSummaryCards(summary: DashboardSummary): readonly SummaryCard[] {
  // 枚数を変えたら待機表示の枠数（`ui/skeleton/skeleton.tsx` の `CARD_COUNT`）も合わせる。
  // 揃っていないと、描画された瞬間に高さが変わって下に置いたものの位置が動く。
  return [
    {
      id: "sales-amount",
      label: "売上",
      value: formatMoney(summary.salesAmount),
      note: "キャンセルを除き、未払いを含みます",
    },
    {
      id: "sales-count",
      label: "売上の件数",
      value: formatCount(summary.salesCount),
      note: "売上に算入した購入の数です",
    },
    {
      id: "published-product-count",
      label: "公開中の商品",
      value: formatCount(summary.publishedProductCount),
      note: "現在の数です。期間では変わりません",
      // 一覧は公開済みだけを返すため、条件を付けない一覧がそのままこの数になる。
      href: ADMIN_PRODUCT_LIST_PATH,
      linkLabel: "公開中の商品を一覧で見る",
    },
    {
      id: "total-product-count",
      label: "登録済みの商品",
      value: formatCount(summary.totalProductCount),
      note: "未公開を含む現在の数です",
      // 押せません。未公開を含む一覧を返す取得口が契約に無く、公開済みだけの一覧へ送ると
      // 押す前と後で件数が食い違います（`src/features/admin/README.md`「現契約でできないこと」）。
    },
  ];
}

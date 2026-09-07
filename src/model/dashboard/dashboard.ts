/**
 * 集計対象期間に注文された購入を、ステータスごとに数えた 1 行。
 *
 * @remarks
 * ステータスは ID と名称が解決済みで届くため、名称を引き直しません。
 */
export type PurchaseStatusCount = {
  readonly statusId: string;
  readonly statusName: string;
  readonly count: number;
};

/**
 * 管理側が読む横断集計。
 *
 * @remarks
 * **合成はバックエンドが済ませています。** 画面はここにある値をそのまま出すだけで、足したり
 * 割ったりしません。
 *
 * **3 つの値は母集団が違います。** 売上（{@link DashboardSummary.salesAmount} /
 * {@link DashboardSummary.salesCount}）はキャンセルを除いた購入、
 * {@link DashboardSummary.purchaseStatusCounts} はキャンセルを含む購入、商品数は期間に依存しない
 * マスタの現在値です。件数を足し合わせると、どの母集団にも属さない数ができます。
 */
export type DashboardSummary = {
  /** 売上合計。最小単位の整数で持ち、表示の直前に主単位へ戻す。 */
  readonly salesAmount: number;
  /** 売上に算入した購入の件数。 */
  readonly salesCount: number;
  /** ステータス別の件数。期間内に現れたステータスだけが並ぶ。 */
  readonly purchaseStatusCounts: readonly PurchaseStatusCount[];
  /** 登録済みの商品数。未公開を含む。 */
  readonly totalProductCount: number;
  /** 公開済みの商品数。 */
  readonly publishedProductCount: number;
};

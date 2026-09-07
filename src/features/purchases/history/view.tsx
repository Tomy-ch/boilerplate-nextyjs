import type { ReactNode } from "react";
import { withScreenSpan } from "@/observability/render-span";
import { PurchaseFilterDraftProvider } from "./filter-draft";
import type { PeriodSelection } from "./period";
import { PurchasePeriodBar } from "./ui/period-bar/period-bar";
import { PurchasePeriodSheet } from "./ui/period-sheet/period-sheet";

/** `PurchaseHistoryView` の props。 */
export type PurchaseHistoryViewProps = {
  /** いま効いている期間。 */
  period: PeriodSelection;
  /** 一覧本体。取得の仕方で差し替えられるよう外から受け取る。 */
  children: ReactNode;
};

/**
 * 購入履歴の画面。
 *
 * @remarks
 * 取得を持ちません。一覧本体を受け取る形にしてあるのは、画面の組み方の確認に取得を必要と
 * しないようにするためです。**同時に、期間が変わったときに取り直す範囲をここで区切っています。**
 * 絞り込みの操作はこの外側にあり、一覧が取り直されても待機表示に落ちません。
 *
 * **絞り込む条件は期間ひとつなので、`FilterBar` を使いません**（理由は README 参照）。解除は
 * 区分を全期間に戻すだけで足ります。
 *
 * **入力欄を 2 つ置き、CSS の段で出し分けます。** 広い幅では帯として常設し、脇に領域を持てない
 * 幅では下端に固定した操作から overlay を開きます。位置が動く出し分けを JS の幅判定で行うと、
 * サーバでは判定できないため hydration の前後で配置が動きます。組み立て中の期間は供給で 1 つに
 * 保つので、どちらから確定しても同じ条件が飛びます。
 *
 * 下端に余白を空けるのは、固定した操作が一覧の最後の行に重なるためです。
 *
 * overlay を開く操作は本文の段組みの外へ出します。viewport の下端に固定されていて本文の高さを
 * 持たないため、段の中に置くと**中身の無い段の分だけ余白が空きます**。
 *
 * パンくずは置きません。global nav がこの画面を直接指しており、階層が 1 段だからです。
 */
export const PurchaseHistoryView = withScreenSpan(
  "features/purchases/history/view",
  ({ period, children }: PurchaseHistoryViewProps) => {
    return (
      <PurchaseFilterDraftProvider period={period}>
        <div className="flex flex-col gap-6 pb-24 lg:pb-0">
          <div className="hidden lg:block">
            <PurchasePeriodBar />
          </div>
          {children}
        </div>
        <div className="lg:hidden">
          <PurchasePeriodSheet period={period} />
        </div>
      </PurchaseFilterDraftProvider>
    );
  },
);

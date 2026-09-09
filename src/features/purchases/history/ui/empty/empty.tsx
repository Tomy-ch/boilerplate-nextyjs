import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { PRODUCT_LIST_PATH } from "@/features/products/facade/list-url/list-url";
import { withPartSpan } from "@/observability/render-span";

/**
 * `PurchaseHistoryEmpty` の props。
 *
 * @remarks
 * 「まだ買っていない」と「絞り込んだ結果が無い」は、利用者にとって別の事態です。前者から出せる
 * のは買い物へ戻る道だけで、後者は条件を外せば結果が出ます。真偽値で分けると、条件を外す行き先を
 * 渡し忘れた「絞り込んだ結果が無い」を書けてしまいます。
 */
export type PurchaseHistoryEmptyProps =
  /** 購入そのものが 1 件も無い。 */
  | { readonly reason: "none" }
  /** 絞り込んだ結果が 0 件。 */
  | { readonly reason: "filtered"; readonly resetHref: string };

/**
 * 並べるものが無いときの表示。
 *
 * @remarks
 * 絞り込んだ結果が 0 件のときに「購入がありません」とだけ出すと、条件を外せば出てくることが
 * 画面から読み取れません。買った覚えのある利用者にとっては、履歴が消えたようにも見えます。
 */
export const PurchaseHistoryEmpty = withPartSpan(
  "features/purchases/history/ui/empty/empty",
  (props: PurchaseHistoryEmptyProps) => {
    if (props.reason === "none") {
      return (
        <div className="flex flex-col items-start gap-4 py-8">
          <p className="text-muted-foreground">購入がまだありません。</p>
          <Button asChild variant={BUTTON_VARIANT.OUTLINE}>
            <Link href={PRODUCT_LIST_PATH}>商品を探す</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-start gap-4 py-8">
        <p className="text-muted-foreground">この期間の購入はありません。</p>
        <Button asChild variant={BUTTON_VARIANT.OUTLINE}>
          <Link href={props.resetHref}>全期間で見る</Link>
        </Button>
      </div>
    );
  },
);

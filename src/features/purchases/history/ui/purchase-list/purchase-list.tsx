import type { RefObject } from "react";

import { LoadMore } from "@/components/app-starter/load-more/load-more";
import type { LoadMoreState } from "@/components/app-starter/load-more/load-more.definition";
import type { PurchaseHistoryEntry } from "@/model/purchase/purchase";
import { withPartSpan } from "@/observability/render-span";
import { PurchaseRow } from "../purchase-row/purchase-row";
import { PurchaseHistorySkeleton } from "../skeleton/skeleton";

/** 一覧に並ぶ 1 件と、その詳細の行き先。 */
export type PurchaseListEntry = {
  readonly purchase: PurchaseHistoryEntry;
  readonly href: string;
};

/** `PurchaseLoadMoreList` の props。 */
export type PurchaseLoadMoreListProps = {
  /** 読み込み済みのすべての購入。 */
  entries: readonly PurchaseListEntry[];
  /** 続きの読み込みの状態。 */
  loadMore: LoadMoreState;
  /** 末尾到達を見張る目印を置く先。scroll で読み進める側が渡す。 */
  sentinelRef?: RefObject<HTMLDivElement | null>;
};

/**
 * 読み進めた購入履歴の見た目。
 *
 * @remarks
 * 取得を持ちません。読み込み済みの件数と並びだけを描き、続きの読み込みの見え方は
 * [`LoadMore`](../../../../../components/app-starter/load-more/README.md) が持ちます。
 *
 * 総数は出しません。契約が返すのは 1 ページと次の鍵だけで、期間で絞った結果が全部で何件あるかは
 * 読み終えるまで判りません。読み込んだ数を「全体の何件中」の形に見せると、実際には知らない数を
 * 知っているように読めます。
 *
 * 件数を読み上げへ伝えます。追加された購入は一覧の末尾に増えるだけなので、伝えないと画面を
 * 見ていない利用者には何も起きていないのと区別が付きません。読み込み中の報告を同じ文へ
 * まとめないのは、読み込みのたびに件数まで読み直されるためです。
 */
export const PurchaseLoadMoreList = withPartSpan(
  "features/purchases/history/ui/purchase-list/purchase-list",
  ({ entries, loadMore, sentinelRef }: PurchaseLoadMoreListProps) => {
    return (
      <div className="flex flex-col gap-4">
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {`${entries.length} 件を表示中`}
        </p>
        <ul className="divide-y rounded-lg border">
          {entries.map((entry) => (
            <PurchaseRow href={entry.href} key={entry.purchase.code} purchase={entry.purchase} />
          ))}
        </ul>
        <LoadMore
          placeholder={<PurchaseHistorySkeleton />}
          sentinelRef={sentinelRef}
          state={loadMore}
        />
      </div>
    );
  },
);

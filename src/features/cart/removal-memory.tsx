"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** 取り除いた明細のうち、戻すために要る値。 */
export type RemovedCartLine = {
  productId: string;
  /** 利用者に見せる名前。 */
  name: string;
  /** 取り除いた時点の数量。戻すときはこの数量で入れ直す。 */
  quantity: number;
};

type RemovalNotice = {
  /** 取り除いた明細。商品で引ける。 */
  removed: ReadonlyMap<string, RemovedCartLine>;
  /** 画面が見せていた並び。取り除いた明細も、消える前に居た場所に残る。 */
  order: readonly string[];
  /** 取り除いたことと、そのとき画面が並べていた順を知らせる。 */
  notify: (line: RemovedCartLine, displayedOrder: readonly string[]) => void;
};

const RemovalNoticeContext = createContext<RemovalNotice | null>(null);

/** 今まさに画面が並べている順。取り除いた時点の姿を覚えるために読む。 */
const DisplayedOrderContext = createContext<readonly string[]>([]);

/**
 * 取り除いた明細と、画面が見せていた並びを覚えておく器。
 *
 * @remarks
 * **どちらもサーバが持たない情報です。** 取り除いた明細はサーバの応答から既に消えており、並びは
 * 画面の見え方そのものです。サーバの応答から直前の姿を組み立て直すのではなく、見せていた側が
 * そのまま覚えます。
 *
 * **1 件ずつではなく溜めます。** 続けて 2 件取り除いたときに先の 1 件を忘れると、戻す手段が
 * 消えた側だけ失われます。商品で引ける形にしてあるのは、取り除き直したときに古い記録を置き換える
 * ためです（数量が変わっています）。
 *
 * **カートの器よりも外に置きます。** 最後の 1 件を取り除くとカートの表示自体が空の姿へ変わるため、
 * 中身の側に持つとその切り替わりで記憶ごと失われます。
 *
 * `stores` へは置きません。これはカートの中だけで閉じる状態で、他の feature は読みません。
 */
export function CartRemovalNoticeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    removed: ReadonlyMap<string, RemovedCartLine>;
    order: readonly string[];
  }>({ removed: new Map(), order: [] });

  // 取り除いた明細と並びは 1 つの更新で動かす。別々に持つと、並びを詰め直す側が「今どれを取り除いて
  // いるか」を知らないまま走り、まだ戻せる明細を並びから落とす。
  const notify = useCallback((line: RemovedCartLine, displayedOrder: readonly string[]) => {
    setState((current) => {
      const removed = new Map(current.removed).set(line.productId, line);
      // 残すのは、今も画面に並んでいるものと、まだ戻せるもの。どちらでもないものは戻された明細で、
      // 覚えておく理由が無い。
      const kept = current.order.filter((id) => displayedOrder.includes(id) || removed.has(id));

      return {
        removed,
        order: [...kept, ...displayedOrder.filter((id) => !kept.includes(id))],
      };
    });
  }, []);

  const value = useMemo<RemovalNotice>(
    () => ({ removed: state.removed, order: state.order, notify }),
    [state, notify],
  );

  return <RemovalNoticeContext.Provider value={value}>{children}</RemovalNoticeContext.Provider>;
}

/**
 * 取り消しの器へ知らせる口。
 *
 * @remarks
 * 器の外でも操作は成立します（器を持たない場所に置いた 1 行だけの story など）。その場合は
 * 取り消しが出ないだけで、削除そのものは通ります。
 *
 * @returns 器が無ければ null
 */
export function useCartRemovalNotice(): RemovalNotice | null {
  return useContext(RemovalNoticeContext);
}

/**
 * 今まさに画面が並べている順を配る。
 *
 * @remarks
 * 並びを知っているのは並べている器だけです。行 1 つずつに順を持たせると、行の数だけ同じ一覧を
 * 運ぶことになります。
 */
export function CartDisplayedOrder({
  order,
  children,
}: {
  order: readonly string[];
  children: ReactNode;
}) {
  return <DisplayedOrderContext.Provider value={order}>{children}</DisplayedOrderContext.Provider>;
}

/** 今まさに画面が並べている順。器の外では空。 */
export function useDisplayedOrder(): readonly string[] {
  return useContext(DisplayedOrderContext);
}

/**
 * いま戻せる明細。
 *
 * @remarks
 * 判定は**カートの中身から導きます**。取り除いた商品がまだ居るなら、削除が通らなかったか、既に
 * 戻したかのどちらかです。取り下げの合図を操作の側から受け取らないのは、合図を送る部品（削除の
 * ボタン）が送った直後に消えるためです。
 *
 * @param presentProductIds - いまカートに入っている商品
 */
export function usePendingRemovals(
  presentProductIds: readonly string[],
): ReadonlyMap<string, RemovedCartLine> {
  const notice = useCartRemovalNotice();
  const removed = notice?.removed;

  return useMemo(
    () =>
      new Map(
        [...(removed ?? new Map<string, RemovedCartLine>())].filter(
          ([productId]) => !presentProductIds.includes(productId),
        ),
      ),
    [removed, presentProductIds],
  );
}

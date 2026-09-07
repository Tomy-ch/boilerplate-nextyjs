"use client";

import type { ReactNode } from "react";

import { cn } from "@/components/cn";

import { toCartLineOrder } from "../../line-order";
import { CartDisplayedOrder, useCartRemovalNotice, usePendingRemovals } from "../../removal-memory";
import { CartRemovalNotice } from "../removal-notice/removal-notice";

/** 並べる明細 1 つ。行の組み立ては server 側で済ませ、この器は並べる順だけを持つ。 */
export type CartLineSlot = {
  productId: string;
  row: ReactNode;
};

/** `CartLineList` の props。 */
export type CartLineListProps = {
  /** いまカートに入っている明細。並びはサーバが返した順。 */
  slots: readonly CartLineSlot[];
  /** 器の見た目。呼び出し元が渡す。 */
  className?: string;
};

/**
 * 明細を並べ、取り除いた行があった場所に取り消しを差し込む器。
 *
 * @remarks
 * **消えた行と同じ場所に案内を置きます。** ゴミ箱を押した場所と案内の出る場所がずれると、どの行が
 * 消えたのかを利用者が目で辿り直すことになります。押した行がそのまま「削除しました」に差し替わる
 * 形にして、視線を動かさずに取り消せるようにしています。
 *
 * **場所は番号ではなく並びで持ちます。** 番号はほかの行が増減するたびに指す先が変わり、続けて
 * 取り除くとずれます。覚えるのは画面が見せていた順そのもので、これはサーバが持たない情報です。
 *
 * 行そのものは server が組み立てたものを受け取ります。この器が持つのは並べる順だけで、明細の
 * 見た目は知りません。
 */
export function CartLineList({ slots, className }: CartLineListProps) {
  const present = slots.map((slot) => slot.productId);
  const remembered = useCartRemovalNotice()?.order ?? [];
  const pending = usePendingRemovals(present);
  const sequence = toCartLineOrder(remembered, present, new Set(pending.keys()));
  // 並べる順に対して、その場所へ置くものを 1 つの表から引く。行と取り消しは同時に立たない
  // （戻せる明細は、カートに居ない明細だけ）。
  const nodes = new Map<string, ReactNode>(slots.map((slot) => [slot.productId, slot.row]));

  for (const [productId, removed] of pending) {
    nodes.set(
      productId,
      <li className="py-4" key={`removed-${productId}`}>
        <CartRemovalNotice removed={removed} />
      </li>,
    );
  }

  return (
    <CartDisplayedOrder order={present}>
      <ul className={cn("flex flex-col divide-y", className)}>
        {sequence.map((productId) => nodes.get(productId))}
      </ul>
    </CartDisplayedOrder>
  );
}

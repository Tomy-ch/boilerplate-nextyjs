"use client";

import { useActionState } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { UndoIcon } from "@/components/icon";
import { idleActionState } from "@/model/action-state";

import { type CartActionState, setCartItemQuantityAction } from "../../actions";
import { type RemovedCartLine, usePendingRemovals } from "../../removal-memory";

/** `CartRemovalNotice` の props。 */
export type CartRemovalNoticeProps = {
  /** 戻せる明細 1 件。 */
  removed: RemovedCartLine;
};

/**
 * 取り除いた明細を戻せることを伝える表示。
 *
 * @remarks
 * **置き場所は持ちません。** 明細の中では消えた行の位置に差し込まれ、明細が 1 つも無い姿では
 * 単独で出ます。位置を決めるのは呼び出し元です。
 *
 * 出すのは 1 行の削除だけです。カートを空にする操作は確認を挟んでおり、取り消しを二重に置くと
 * 「確認したのに戻せる」と「戻せるから確認は要らない」のどちらとも取れます。
 *
 * **押しても自分から消えません。** 送信の途中で自分を畳むと、投げ終える前に form ごと居なくなり、
 * 戻す要求が届きません。消えるのは明細がカートへ戻ったときで、判定は {@link usePendingRemovals}
 * が持ちます。
 *
 * 戻すのは数量の設定です。取り除いた時点の数量をそのまま入れ直すため、専用の口を持ちません。
 *
 * 操作の名前に商品名を含めます。案内は同時に複数並ぶため、文言だけではどれを戻す操作かを
 * 区別できません（[0053](../../../../../docs/adr/0053-ui-component-interaction-seam.md) の
 * 「1 つの操作に 1 つの role」）。
 */
export function CartRemovalNotice({ removed }: CartRemovalNoticeProps) {
  const [, formAction] = useActionState<CartActionState, FormData>(
    setCartItemQuantityAction,
    idleActionState(),
  );

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
      role="status"
    >
      <p className="min-w-0 text-sm">{`${removed.name} を削除しました`}</p>
      <form action={formAction}>
        <input name="productId" type="hidden" value={removed.productId} />
        <input name="quantity" type="hidden" value={removed.quantity} />
        <Button
          aria-label={`${removed.name} をカートに戻す`}
          size="sm"
          type="submit"
          variant="outline"
        >
          <UndoIcon aria-hidden="true" className="size-4" />
          カートに戻す
        </Button>
      </form>
    </div>
  );
}

/** `CartRemovalNoticeList` の props。 */
export type CartRemovalNoticeListProps = {
  /** いまカートに入っている商品。戻せるかどうかの判定に使う。 */
  presentProductIds: readonly string[];
};

/**
 * 戻せる明細をまとめて出す。
 *
 * @remarks
 * 明細が 1 つも無い姿で使います。並べる相手が無いため位置を持てず、取り除いた順に積みます。
 * 明細が残っている場合は `CartLineList` が並びの中へ差し込みます。
 */
export function CartRemovalNoticeList({ presentProductIds }: CartRemovalNoticeListProps) {
  const pending = usePendingRemovals(presentProductIds);

  if (pending.size === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {[...pending.values()].map((line) => (
        <CartRemovalNotice key={line.productId} removed={line} />
      ))}
    </div>
  );
}

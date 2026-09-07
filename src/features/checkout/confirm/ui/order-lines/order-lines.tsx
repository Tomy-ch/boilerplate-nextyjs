"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";

import { Button } from "@/components/design-system/action/button/button";
import {
  BUTTON_SIZE,
  BUTTON_VARIANT,
} from "@/components/design-system/action/button/button.definition";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/design-system/display/card/card";
import type { CartLine } from "@/model/cart/cart";

import { CART_PATH } from "../../../paths";
import { OrderLineRow } from "../order-line-row/order-line-row";

/** `OrderLines` の props。 */
export type OrderLinesProps = {
  /** 再掲する明細。 */
  lines: readonly CartLine[];
};

/**
 * 畳まずに出す明細の数。
 *
 * @remarks
 * カートは契約上 50 行まで入ります。全部を常に並べると、確定するまでの丈がその行数に比例します。
 */
const VISIBLE_LIMIT = 10;

/**
 * 確定する内容の再掲。
 *
 * @remarks
 * 直す手段はカートへ戻す導線 1 本だけです。この画面が持つのは「これで確定してよいか」を
 * 確かめる役目で、直すのはカートの役目です。
 *
 * **多い明細は畳みますが、隠しません。** 払う前に全部を確かめられることがこの画面の役目なので、
 * ページで割って別の画面へ送らず、その場で開ける形にします。件数は畳んだままでも見出しに出ます。
 *
 * **開け閉めの操作は明細の下に置きます。** 開いた直後にいる場所と、畳むために押す場所が同じに
 * なるためです。上に置くと、開いた内容を読み終えた位置から操作まで戻ることになります。
 *
 * **脇に集計を置ける幅では、その操作を器の下端へ貼り付けます。** 明細が画面の高さを超えても、
 * 畳む手段が読んでいる位置から届きます。それ未満の幅で貼り付けないのは、画面の下端を確定の帯が
 * 占めており、二つが重なるためです（`docs/rules.md`「レイアウトと帯」の「常に届く操作は `lg` 未満で
 * 画面下端に固定する」）。
 */
export function OrderLines({ lines }: OrderLinesProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const foldedCount = lines.length - VISIBLE_LIMIT;
  const shown = expanded ? lines : lines.slice(0, VISIBLE_LIMIT);

  const toggle = useCallback(() => {
    setExpanded((current) => {
      // 畳むと上の行が縮み、押した操作が画面の外へ出る。押した場所を視野に残す。
      if (current) {
        requestAnimationFrame(() => toggleRef.current?.scrollIntoView({ block: "nearest" }));
      }

      return !current;
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{`ご注文内容（全 ${lines.length} 件）`}</CardTitle>
        <CardAction>
          <Button asChild size={BUTTON_SIZE.SMALL} variant={BUTTON_VARIANT.OUTLINE}>
            <Link href={CART_PATH}>カートを修正する</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col">
        <ul className="divide-y" id={listId}>
          {shown.map((line) => (
            <OrderLineRow key={line.productId} line={line} />
          ))}
        </ul>
        {foldedCount <= 0 ? null : (
          <div className="flex justify-center pt-3 lg:sticky lg:bottom-4">
            <Button
              aria-controls={listId}
              aria-expanded={expanded}
              className="shadow-sm"
              onClick={toggle}
              ref={toggleRef}
              size={BUTTON_SIZE.SMALL}
              variant={BUTTON_VARIANT.OUTLINE}
            >
              {expanded ? "折りたたむ" : `残り ${foldedCount} 件を表示`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

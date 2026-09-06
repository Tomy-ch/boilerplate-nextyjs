"use client";

import { useCallback } from "react";

import { PrinterIcon } from "@/components/icon";

import { Button } from "../button/button";

/**
 * 表示中の文書を印刷する操作。
 *
 * @remarks
 * 印刷基盤（[`foundation/print`](../../foundation/print/README.md)）は紙面の体裁だけを持ち、印刷の
 * 実行は持ちません。この component が担うのはその実行だけで、**何を紙へ出すかは持ちません**。
 *
 * 印刷の対象を指定していません。`window.print()` は文書全体を対象にし、何を落とすかは
 * `print-hidden` を付けた各要素が決めます。ここで範囲を切ると、同じ判断が操作側と表示側の
 * 2 か所に分かれます。
 *
 * 自分自身を紙へ出しません。押せない操作が紙面に残ると、その分だけ内容が押し出されます。
 *
 * @example
 * ```tsx
 * import { PrintButton } from "@/components/design-system/action/print-button/print-button";
 *
 * <PrintButton />;
 * ```
 *
 * @see Storybook `Action/PrintButton`
 */
export function PrintButton() {
  const print = useCallback(() => {
    window.print();
  }, []);

  return (
    <Button className="print-hidden" onClick={print} size="sm" type="button" variant="outline">
      <PrinterIcon aria-hidden="true" className="size-4" />
      印刷する
    </Button>
  );
}

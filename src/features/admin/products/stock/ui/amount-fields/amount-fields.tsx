"use client";

import { useCallback, useId, useState } from "react";

import { Label } from "@/components/design-system/form/label/label";
import {
  RadioGroupNative,
  RadioGroupNativeItem,
} from "@/components/design-system/form/radio-group-native/radio-group-native";

import { ProductTextField } from "../../../ui/text-field/text-field";
import { STOCK_FORM_NAMES } from "../../form-names";
import type { StockDirection } from "../../stock-direction";
import {
  DEFAULT_STOCK_DIRECTION,
  STOCK_DIRECTION,
  STOCK_DIRECTION_LABELS,
} from "../../stock-direction";
import { toStockQuantity } from "../../stock-quantity";
import { StockProjection } from "../projection/projection";

const DIRECTIONS: readonly StockDirection[] = [STOCK_DIRECTION.REPLENISH, STOCK_DIRECTION.DEDUCT];

/** `StockAmountFields` の props。 */
export type StockAmountFieldsProps = {
  /** 読み込んだ時点の在庫数。見込みの起点になる。 */
  current: number;
  /** 量の欄に出す誤りの文言。 */
  message?: string;
};

/**
 * 在庫をどちらへいくつ動かすかを決める欄。
 *
 * @remarks
 * **打っている途中の値をここが持ちます。** 送信には欄の `name` で載るため、外側のフォームは
 * この値を知らずに済みます。向きと量を 1 つの部品にまとめてあるのは、見込みがその両方から
 * 決まるためです。
 *
 * **native の radio で組みます。**選択肢は 2 つで固定され、独自の keyboard 操作も client state も
 * 要りません。符号を人に書かせず向きで受ける理由は
 * [`STOCK_DIRECTION`](../../stock-direction.ts)。
 *
 * 量として読めるかは [`toStockQuantity`](../../stock-quantity.ts) が決めます。送信を読む側と同じ
 * 規則なので、見込みが出ているのに弾かれる、が起きません。
 *
 * @see Storybook `Features/Admin/Products/Stock/AmountFields`
 */
export function StockAmountFields({ current, message }: StockAmountFieldsProps) {
  const idPrefix = useId();
  const [direction, setDirection] = useState<StockDirection>(DEFAULT_STOCK_DIRECTION);
  const [quantity, setQuantity] = useState("");

  const changeDirection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // DOM から返るのは素の文字列。選択肢は 2 つしかないので、差し引きかどうかだけを見る。
    setDirection(
      event.target.value === STOCK_DIRECTION.DEDUCT
        ? STOCK_DIRECTION.DEDUCT
        : STOCK_DIRECTION.REPLENISH,
    );
  }, []);

  // 量の欄は focus が外れたことを外へ伝えない。結果を取り下げる合図は、外側の form が入力ごとに拾う。
  const leave = useCallback(() => undefined, []);

  return (
    <>
      <RadioGroupNative className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <legend className="mb-2 font-emphasis text-sm">操作</legend>
        {DIRECTIONS.map((value) => (
          <Label className="flex items-center gap-2" htmlFor={`${idPrefix}${value}`} key={value}>
            <RadioGroupNativeItem
              checked={direction === value}
              id={`${idPrefix}${value}`}
              name={STOCK_FORM_NAMES.direction}
              onChange={changeDirection}
              value={value}
            />
            {STOCK_DIRECTION_LABELS[value]}
          </Label>
        ))}
      </RadioGroupNative>

      <div className="grid gap-2 sm:max-w-xs">
        <ProductTextField
          controlId={`${idPrefix}quantity`}
          inputMode="numeric"
          label="数量"
          min={1}
          name={STOCK_FORM_NAMES.quantity}
          onLeave={leave}
          onValueChange={setQuantity}
          required={true}
          step={1}
          type="number"
          value={quantity}
          {...(message === undefined ? {} : { message })}
        />
        <StockProjection
          current={current}
          direction={direction}
          quantity={toStockQuantity(quantity)}
        />
      </div>
    </>
  );
}

import { fn } from "storybook/test";

import { succeededActionState } from "@/model/action-state";

import type { PurchaseTransitionState } from "../form-state";

/**
 * カタログでの [payPurchaseAction](../actions.ts)。
 *
 * @remarks
 * 本物は成立すると画面を取り直し、押した操作はその場から消えます。カタログには取り直す先が
 * 無いので、成功を返して押した後の画面に留まります。
 */
export const payPurchaseAction = fn(
  async (): Promise<PurchaseTransitionState> => succeededActionState(undefined),
).mockName("payPurchaseAction");

/** カタログでの [cancelPurchaseAction](../actions.ts)。 */
export const cancelPurchaseAction = fn(
  async (): Promise<PurchaseTransitionState> => succeededActionState(undefined),
).mockName("cancelPurchaseAction");

import { describe, expect, it } from "vitest";

import { BADGE_VARIANT } from "@/components/design-system/display/badge/badge.definition";
import { PURCHASE_STATUS } from "@/model/purchase/purchase-status";

import { toStatusEmphasis } from "./status-emphasis";

describe("toStatusEmphasis", () => {
  // ----- 正常系 -----
  it("完了は望ましい終端として示す", () => {
    expect(toStatusEmphasis(PURCHASE_STATUS.COMPLETED)).toBe(BADGE_VARIANT.SUCCESS);
  });

  it("配達済みも望ましい終端として示す", () => {
    expect(toStatusEmphasis(PURCHASE_STATUS.DELIVERED)).toBe(BADGE_VARIANT.SUCCESS);
  });

  it("キャンセルは取り消しとして示す", () => {
    expect(toStatusEmphasis(PURCHASE_STATUS.CANCELED)).toBe(BADGE_VARIANT.DESTRUCTIVE);
  });

  it("まだ動いている状態には色を付けない", () => {
    expect(toStatusEmphasis(PURCHASE_STATUS.SHIPPED)).toBe(BADGE_VARIANT.SECONDARY);
    expect(toStatusEmphasis(PURCHASE_STATUS.PAID)).toBe(BADGE_VARIANT.SECONDARY);
  });

  // ----- 異常系 -----
  it("マスタに増えた業務キーは、どの区分にも寄せず装飾を持たない姿にする", () => {
    expect(toStatusEmphasis(99)).toBe(BADGE_VARIANT.GHOST);
  });
});

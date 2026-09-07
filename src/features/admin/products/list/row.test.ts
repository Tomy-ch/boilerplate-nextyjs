import { describe, expect, it } from "vitest";

import { BADGE_VARIANT } from "@/components/design-system/display/badge/badge.definition";
import type { Product, ProductStatus } from "@/model/product/product";
import { toProductId } from "@/model/product/product";

import { toAdminProductRows } from "./row";

const STATUS_ID = "6b0f2f3e-0000-4000-8000-000000000001";

const STATUSES = [
  { id: STATUS_ID, name: "在庫切れ", code: 2 },
  { id: "6b0f2f3e-0000-4000-8000-000000000002", name: "在庫あり", code: 1 },
] satisfies readonly [ProductStatus, ...ProductStatus[]];

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: toProductId("0195f0c2-0000-7000-8000-000000000001"),
    name: "ワイヤレスイヤホン",
    description: null,
    price: "19.99",
    quantity: 12,
    stockWarningThreshold: null,
    status: { id: STATUS_ID, name: "在庫切れ" },
    category: { id: "c1", name: "電子機器" },
    publishedAt: null,
    discontinuedAt: null,
    imagePaths: [],
    version: 1,
    ...overrides,
  };
}

describe("toAdminProductRows", () => {
  // ----- 正常系 -----
  it("表に出す項目だけを写す", () => {
    expect(toAdminProductRows([product()], STATUSES)[0]).toEqual({
      id: product().id,
      name: "ワイヤレスイヤホン",
      price: "19.99",
      quantity: 12,
      categoryName: "電子機器",
      statusName: "在庫切れ",
      statusTone: BADGE_VARIANT.DESTRUCTIVE,
    });
  });

  it("状態の指し先からコードを引いて見た目を決める", () => {
    const rows = toAdminProductRows(
      [product({ status: { id: STATUSES[1].id, name: "在庫あり" } })],
      STATUSES,
    );

    expect(rows[0]?.statusTone).toBe(BADGE_VARIANT.SECONDARY);
  });

  it("廃番の商品は、マスタのラベルではなく廃番として出す", () => {
    const rows = toAdminProductRows(
      [
        product({
          status: { id: STATUSES[1].id, name: "在庫あり" },
          discontinuedAt: new Date("2026-09-05T00:00:00.000Z"),
        }),
      ],
      STATUSES,
    );

    expect(rows[0]?.statusName).toBe("廃番");
  });

  it("廃番の商品は、マスタのコードから決まる見た目にも従わない", () => {
    const rows = toAdminProductRows(
      [
        product({
          status: { id: STATUSES[1].id, name: "在庫あり" },
          discontinuedAt: new Date("2026-09-05T00:00:00.000Z"),
        }),
      ],
      STATUSES,
    );

    expect(rows[0]?.statusTone).toBe(BADGE_VARIANT.DEFAULT);
  });

  it("マスタのラベルが廃盤でも、廃番でなければそのラベルのまま出す", () => {
    const rows = toAdminProductRows(
      [product({ status: { id: "6b0f2f3e-0000-4000-8000-000000000003", name: "廃盤" } })],
      [...STATUSES, { id: "6b0f2f3e-0000-4000-8000-000000000003", name: "廃盤", code: 7 }],
    );

    expect(rows[0]).toMatchObject({ statusName: "廃盤", statusTone: BADGE_VARIANT.OUTLINE });
  });

  it("受け取った順序を保つ", () => {
    const rows = toAdminProductRows([product({ name: "A" }), product({ name: "B" })], STATUSES);

    expect(rows.map((row) => row.name)).toEqual(["A", "B"]);
  });

  it("商品が無ければ空を返す", () => {
    expect(toAdminProductRows([], STATUSES)).toEqual([]);
  });

  // ----- 異常系 -----
  it("マスタに無い状態は既定の見た目へ倒す", () => {
    const rows = toAdminProductRows([product()], []);

    expect(rows[0]?.statusTone).toBe(BADGE_VARIANT.GHOST);
  });

  it("マスタに無い状態でも表示名はそのまま出す", () => {
    expect(toAdminProductRows([product()], [])[0]?.statusName).toBe("在庫切れ");
  });
});

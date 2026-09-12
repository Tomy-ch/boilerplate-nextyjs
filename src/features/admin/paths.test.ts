import { describe, expect, it } from "vitest";

import { toInquiryId } from "@/model/inquiry/inquiry";
import { toProductId } from "@/model/product/product";

import {
  adminInquiryDetailPath,
  adminProductEditPath,
  adminProductStockPath,
  productDetailPath,
} from "./paths";

const ID = toProductId("0195f0c2-0000-7000-8000-000000000001");

describe("adminProductEditPath", () => {
  // ----- 正常系 -----
  it("商品の編集画面を指す", () => {
    expect(adminProductEditPath(ID)).toBe(`/admin/products/${ID}/edit`);
  });
});

describe("adminProductStockPath", () => {
  // ----- 正常系 -----
  it("商品の在庫補充画面を指す", () => {
    expect(adminProductStockPath(ID)).toBe(`/admin/products/${ID}/stock`);
  });
});

describe("productDetailPath", () => {
  // ----- 正常系 -----
  it("利用者向けの商品の面を指す", () => {
    expect(productDetailPath(ID)).toBe(`/products/${ID}`);
  });

  it("id に URL で意味を持つ文字が含まれても壊れない", () => {
    expect(productDetailPath(toProductId("a/b?c"))).toBe("/products/a%2Fb%3Fc");
  });
});

describe("adminInquiryDetailPath", () => {
  // ----- 正常系 -----
  it("問い合わせ 1 件の対応画面を指す", () => {
    const inquiryId = toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60");

    expect(adminInquiryDetailPath(inquiryId)).toBe(`/admin/inquiries/${inquiryId}`);
  });

  it("id に URL で意味を持つ文字が含まれても壊れない", () => {
    expect(adminInquiryDetailPath(toInquiryId("a/b?c"))).toBe("/admin/inquiries/a%2Fb%3Fc");
  });
});

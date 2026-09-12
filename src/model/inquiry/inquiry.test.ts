import { describe, expect, it } from "vitest";

import { INQUIRY_AUTHOR_KIND, toInquiryId } from "./inquiry";

describe("toInquiryId", () => {
  it("文字列を問い合わせの識別子として確定させる", () => {
    expect(toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60")).toBe(
      "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60",
    );
  });

  it("実在するかは検査せず、受け取った綴りをそのまま返す", () => {
    expect(toInquiryId("not-a-real-inquiry")).toBe("not-a-real-inquiry");
  });
});

describe("INQUIRY_AUTHOR_KIND", () => {
  it("送り手は、利用者と回答者の 2 つだけを持つ", () => {
    expect(Object.values(INQUIRY_AUTHOR_KIND)).toEqual(["user", "operator"]);
  });
});

import { describe, expect, it } from "vitest";

import { toAdminInquiryListLocation } from "./read-location";

describe("toAdminInquiryListLocation", () => {
  it("条件が無い URL を先頭ページとして読む", () => {
    expect(toAdminInquiryListLocation({})).toEqual({ cursor: null, trail: [] });
  });

  it("起点と通ってきた道を読む", () => {
    expect(toAdminInquiryListLocation({ after: "c2", trail: ["c1"] })).toEqual({
      cursor: "c2",
      trail: ["c1"],
    });
  });

  it("道が 1 件のときも並びとして読む", () => {
    expect(toAdminInquiryListLocation({ after: "c2", trail: "c1" })).toMatchObject({
      trail: ["c1"],
    });
  });

  it("起点が消えた URL では、通ってきた道を捨てる", () => {
    expect(toAdminInquiryListLocation({ trail: ["c1"] })).toEqual({ cursor: null, trail: [] });
  });

  it("起点が繰り返されている URL を、未指定として読む", () => {
    expect(toAdminInquiryListLocation({ after: ["c1", "c2"] })).toMatchObject({ cursor: null });
  });

  it("同じ起点が 2 度並ぶ道を畳まない", () => {
    expect(toAdminInquiryListLocation({ after: "c2", trail: ["c1", "c1"] })).toMatchObject({
      trail: ["c1", "c1"],
    });
  });
});

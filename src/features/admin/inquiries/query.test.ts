import { describe, expect, it } from "vitest";

import { toNextPageHref, toPreviousPageHref } from "./query";

const FIRST_PAGE = { cursor: null, trail: [] };

describe("toNextPageHref", () => {
  it("先頭ページからは、通ってきた道を持たずに進む", () => {
    expect(toNextPageHref(FIRST_PAGE, "c1")).toBe("/admin/inquiries?after=c1");
  });

  it("いまの起点を、通ってきた道へ積む", () => {
    expect(toNextPageHref({ cursor: "c1", trail: [] }, "c2")).toBe(
      "/admin/inquiries?after=c2&trail=c1",
    );
  });

  it("積んだ道を保つ", () => {
    expect(toNextPageHref({ cursor: "c2", trail: ["c1"] }, "c3")).toBe(
      "/admin/inquiries?after=c3&trail=c1&trail=c2",
    );
  });
});

describe("toPreviousPageHref", () => {
  it("先頭ページには戻る先が無い", () => {
    expect(toPreviousPageHref(FIRST_PAGE)).toBeUndefined();
  });

  it("2 ページ目からは先頭へ戻る", () => {
    expect(toPreviousPageHref({ cursor: "c1", trail: [] })).toBe("/admin/inquiries");
  });

  it("積んだ道の末尾へ戻り、その分を降ろす", () => {
    expect(toPreviousPageHref({ cursor: "c3", trail: ["c1", "c2"] })).toBe(
      "/admin/inquiries?after=c2&trail=c1",
    );
  });
});

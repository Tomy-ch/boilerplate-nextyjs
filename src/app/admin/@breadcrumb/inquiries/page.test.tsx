// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminInquiryListBreadcrumb from "./page";

describe("AdminInquiryListBreadcrumb", () => {
  it("一覧では、現在地までの階層を出さない", () => {
    const { container } = render(<AdminInquiryListBreadcrumb />);

    expect(container).toBeEmptyDOMElement();
  });
});

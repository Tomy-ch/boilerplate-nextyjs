import { describe, expect, it } from "vitest";

import { INQUIRY_BODY_MAX_LENGTH } from "./inquiry-limits";

describe("INQUIRY_BODY_MAX_LENGTH", () => {
  it("契約が定めた上限をそのまま公開する", () => {
    expect(INQUIRY_BODY_MAX_LENGTH).toBe(4_000);
  });
});

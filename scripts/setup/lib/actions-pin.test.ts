import { describe, expect, it } from "vitest";

import { dropOrphanedPins } from "./actions-pin";

const LOCK = [
  "# GitHub Actions の pin 対象 SHA（SSOT）。",
  '"actions/cache@v6.1.0" = "55cc8345863c7cc4c66a329aec7e433d2d1c52a9"',
  '"actions/dependency-review-action@v5.0.0" = "a1d282b36b6f3519aa1f3fc636f609c47dddb294"',
  '"actions/checkout@v7.0.0" = "9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0"',
].join("\n");

describe("dropOrphanedPins", () => {
  // ----- 正常系 -----
  it("宣言された action の行を落とす", () => {
    expect(dropOrphanedPins(LOCK, ["actions/dependency-review-action"])).not.toContain(
      "dependency-review-action",
    );
  });

  it("宣言されていない action の行を残す", () => {
    const dropped = dropOrphanedPins(LOCK, ["actions/dependency-review-action"]);

    expect(dropped).toContain("actions/cache@v6.1.0");
    expect(dropped).toContain("actions/checkout@v7.0.0");
  });

  it("ヘッダのコメントを残す", () => {
    expect(dropOrphanedPins(LOCK, ["actions/dependency-review-action"])).toContain(
      "# GitHub Actions の pin 対象 SHA（SSOT）。",
    );
  });

  it("版が変わっても名前で当てる", () => {
    const bumped = LOCK.replace("@v5.0.0", "@v6.1.2");

    expect(dropOrphanedPins(bumped, ["actions/dependency-review-action"])).not.toContain(
      "dependency-review-action",
    );
  });

  it("落とす行が無ければ元のまま返す", () => {
    expect(dropOrphanedPins(LOCK, ["actions/never-used"])).toBe(LOCK);
  });

  it("名前が前方一致するだけの別 action を巻き込まない", () => {
    const similar = `${LOCK}\n"actions/dependency-review-action-extra@v1" = "abc"`;

    expect(dropOrphanedPins(similar, ["actions/dependency-review-action"])).toContain(
      "dependency-review-action-extra",
    );
  });
});

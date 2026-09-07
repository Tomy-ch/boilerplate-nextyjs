import { describe, expect, it } from "vitest";

import { planReplacement } from "./plan";

/** 置換前の木が持つ形。有効側が汎用リンク、退避側が portal のリンク。 */
const MARKED_SOURCE = [
  "// portal:replace-begin",
  'const detailsLink = { href: "https://github.com/", label: "GitHub" };',
  "// portal:replace-with",
  '// = const detailsLink = { href: "__PORTAL_URL__", label: "ドキュメントポータル" };',
  "// portal:replace-end",
  "",
].join("\n");

describe("planReplacement", () => {
  // ----- 正常系 -----
  it("リポジトリ参照の置換と portal の差し替えを両方適用する", () => {
    const planned = planReplacement(
      "story.tsx",
      `// Tomy-ch/nextjs-boilerplate\n${MARKED_SOURCE}`,
      "nextjs-boilerplate",
      "example-org/example-app",
      "https://example-org.github.io/example-app/",
    );

    expect(planned).toEqual({
      content:
        '// example-org/example-app\nconst detailsLink = { href: "https://example-org.github.io/example-app/", label: "ドキュメントポータル" };\n',
      occurrences: 6,
    });
  });

  it("テンプレートからリポジトリ名を据え置いて作った場合でも、差し込んだ URL の host を壊さない", () => {
    const planned = planReplacement(
      "story.tsx",
      MARKED_SOURCE,
      "nextjs-boilerplate",
      "example-org/nextjs-boilerplate",
      "https://example-org.github.io/nextjs-boilerplate/",
    );

    expect(planned?.content).toBe(
      'const detailsLink = { href: "https://example-org.github.io/nextjs-boilerplate/", label: "ドキュメントポータル" };\n',
    );
  });

  it("どちらも当たらない本文は null を返す", () => {
    expect(
      planReplacement(
        "story.tsx",
        "何も無い本文\n",
        "nextjs-boilerplate",
        "example-org/example-app",
        "https://example-org.github.io/example-app/",
      ),
    ).toBeNull();
  });
});

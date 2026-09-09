import { describe, expect, it } from "vitest";

import { applyPortalUrl, buildDefaultPortalUrl } from "./portal";

/** 置換前の木が持つ形。有効側が汎用リンク、退避側が portal のリンク。 */
const MARKED_SOURCE = [
  "// portal:replace-begin",
  'const detailsLink = { href: "https://github.com/", label: "GitHub" };',
  "// portal:replace-with",
  '// = const detailsLink = { href: "__PORTAL_URL__", label: "ドキュメントポータル" };',
  "// portal:replace-end",
  "",
].join("\n");

const PORTAL_URL = "https://example-org.github.io/example-app/";

describe("buildDefaultPortalUrl", () => {
  // ----- 正常系 -----
  it("project site の URL を組み立てる", () => {
    expect(buildDefaultPortalUrl("example-org/example-app")).toBe(
      "https://example-org.github.io/example-app/",
    );
  });

  it("host になる owner だけを小文字へ寄せ、path になる名前の大文字は保つ", () => {
    expect(buildDefaultPortalUrl("Example-Org/Example-App")).toBe(
      "https://example-org.github.io/Example-App/",
    );
  });

  it("リポジトリ名が owner の Pages ドメインなら user site の URL を組み立てる", () => {
    expect(buildDefaultPortalUrl("example-org/example-org.github.io")).toBe(
      "https://example-org.github.io/",
    );
  });
  // ----- 異常系 -----
  it('"/" を含まない参照は、空の答えを返さずに落ちる', () => {
    expect(() => buildDefaultPortalUrl("owner-only")).toThrow(
      '所有者とリポジトリ名を "/" で繋いだ形ではありません',
    );
  });
});

describe("applyPortalUrl", () => {
  // ----- 正常系 -----
  it("有効側の汎用リンクを退避側の portal リンクへ入れ替える", () => {
    const { content } = applyPortalUrl("story.tsx", MARKED_SOURCE, PORTAL_URL);

    expect(content).toBe(
      'const detailsLink = { href: "https://example-org.github.io/example-app/", label: "ドキュメントポータル" };\n',
    );
  });

  it("マーカーで消した 4 行と差し替えた 1 箇所を数える", () => {
    const { changes } = applyPortalUrl("story.tsx", MARKED_SOURCE, PORTAL_URL);

    expect(changes).toBe(5);
  });

  it("差し替えを伴わないマーカー除去だけでも消した行を数える", () => {
    const { content, changes } = applyPortalUrl(
      "story.tsx",
      'const kept = 1;\nconst dropped = "https://github.com/"; // portal:line\n',
      PORTAL_URL,
    );

    expect(content).toBe("const kept = 1;\n");
    expect(changes).toBe(1);
  });

  it("マーカーの外にあるプレースホルダも差し替える", () => {
    const { content, changes } = applyPortalUrl(
      "story.tsx",
      'const href = "__PORTAL_URL__";\n',
      PORTAL_URL,
    );

    expect(content).toBe('const href = "https://example-org.github.io/example-app/";\n');
    expect(changes).toBe(1);
  });

  it("プレースホルダが複数あればすべて差し替える", () => {
    const { content, changes } = applyPortalUrl(
      "story.tsx",
      "__PORTAL_URL__ と __PORTAL_URL__\n",
      PORTAL_URL,
    );

    expect(content).toBe(
      "https://example-org.github.io/example-app/ と https://example-org.github.io/example-app/\n",
    );
    expect(changes).toBe(2);
  });

  it("マーカーを持たない本文は汎用リンクのまま返す", () => {
    const original = 'const href = "https://github.com/";\n';

    expect(applyPortalUrl("story.tsx", original, PORTAL_URL)).toEqual({
      content: original,
      changes: 0,
    });
  });

  it("URL を正規表現の置換文字列として解釈せず、そのまま埋め込む", () => {
    const { content } = applyPortalUrl("story.tsx", MARKED_SOURCE, "https://docs.example.com/$&/");

    expect(content).toBe(
      'const detailsLink = { href: "https://docs.example.com/$&/", label: "ドキュメントポータル" };\n',
    );
  });

  // ----- 異常系 -----
  it("対応の取れないマーカーを、崩れているファイルの名前を添えて拒否する", () => {
    expect(() => applyPortalUrl("src/story.tsx", "// portal:replace-begin\n", PORTAL_URL)).toThrow(
      "src/story.tsx: portal:replace-begin に対応する portal:replace-end が見つかりません。",
    );
  });

  it("退避側に退避コメント以外の行があるとき、書式の誤りを伝える", () => {
    const malformed = [
      "// portal:replace-begin",
      'const href = "https://github.com/";',
      "// portal:replace-with",
      'const href = "__PORTAL_URL__";',
      "// portal:replace-end",
      "",
    ].join("\n");

    expect(() => applyPortalUrl("src/story.tsx", malformed, PORTAL_URL)).toThrow(
      "portal:replace-with 〜 replace-end の行は // = / # = / <!-- = --> のいずれかで書いてください",
    );
  });

  it("閉じだけが現れたブロックマーカーを拒否する", () => {
    expect(() => applyPortalUrl("src/story.tsx", "// portal:end\n", PORTAL_URL)).toThrow(
      "src/story.tsx: portal:end に対応する portal:begin が見つかりません。",
    );
  });
});

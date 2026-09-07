import { describe, expect, it } from "vitest";

import { applyRepositoryReference } from "./reference";

const CURRENT = "nextjs-boilerplate";
const REPOSITORY = "example-org/example-app";

describe("applyRepositoryReference", () => {
  // ----- 正常系 -----
  it("<owner>/<現プロジェクト名> 形式の参照を owner ごと書き換える", () => {
    expect(
      applyRepositoryReference(
        "https://github.com/Tomy-ch/nextjs-boilerplate/issues",
        CURRENT,
        REPOSITORY,
      ),
    ).toEqual({ content: "https://github.com/example-org/example-app/issues", occurrences: 1 });
  });

  it("単独で現れるプロジェクト名を書き換える", () => {
    expect(applyRepositoryReference('"name": "nextjs-boilerplate"', CURRENT, REPOSITORY)).toEqual({
      content: '"name": "example-app"',
      occurrences: 1,
    });
  });

  it("拡張子を境界として扱い、名前の後ろでは切らない", () => {
    const { content } = applyRepositoryReference(
      "nextjs-boilerplate.md と nextjs-boilerplate-extra",
      CURRENT,
      REPOSITORY,
    );

    expect(content).toBe("example-app.md と nextjs-boilerplate-extra");
  });

  it("別の名前の末尾に埋まっているものは書き換えない", () => {
    expect(applyRepositoryReference("my-nextjs-boilerplate", CURRENT, REPOSITORY)).toEqual({
      content: "my-nextjs-boilerplate",
      occurrences: 0,
    });
  });

  it("スラッグと単独名を二重に数えず、両方を書き換える", () => {
    expect(
      applyRepositoryReference(
        "Tomy-ch/nextjs-boilerplate と nextjs-boilerplate",
        CURRENT,
        REPOSITORY,
      ),
    ).toEqual({ content: "example-org/example-app と example-app", occurrences: 2 });
  });

  it("現プロジェクト名の . を正規表現の任意 1 文字として扱わない", () => {
    const { content } = applyRepositoryReference(
      "my.app と myXapp",
      "my.app",
      "example-org/renamed",
    );

    expect(content).toBe("renamed と myXapp");
  });

  it("$ を含む書き換え先を、スラッグ側でも単独名側でも後方参照として解釈しない", () => {
    const { content } = applyRepositoryReference(
      "owner/nextjs-boilerplate と nextjs-boilerplate",
      CURRENT,
      "example-org/app$&name",
    );

    expect(content).toBe("example-org/app$&name と app$&name");
  });

  it("現れない本文はそのまま返す", () => {
    expect(applyRepositoryReference("何も無い本文", CURRENT, REPOSITORY)).toEqual({
      content: "何も無い本文",
      occurrences: 0,
    });
  });

  // ----- 異常系 -----
  it('"/" を含まない参照は、空の答えを返さずに落ちる', () => {
    expect(() => applyRepositoryReference("本文", CURRENT, "owner-only")).toThrow(
      '所有者とリポジトリ名を "/" で繋いだ形ではありません',
    );
  });
});

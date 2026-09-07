import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  collectRefs,
  composeImagePattern,
  dockerfileFromPattern,
  type PinTarget,
  parseRef,
  refKey,
  targetFiles,
  unparsedLines,
  usesDockerPattern,
} from "./image-reference";

let root: string;

/** リポジトリ相対のパスへ内容を書く。途中のディレクトリも作る。 */
function write(relative: string, content: string): string {
  const file = join(root, relative);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content);

  return file;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "images-pin-ref-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("refKey", () => {
  // ----- 正常系 -----
  it("image と tag を参照の形へ戻す", () => {
    expect(refKey({ image: "alpine", tag: "3.24" })).toBe("alpine:3.24");
  });
});

describe("parseRef", () => {
  // ----- 正常系 -----
  it("image と tag へ分ける", () => {
    expect(parseRef("alpine:3.24")).toEqual({ image: "alpine", tag: "3.24" });
  });

  it("registry を含む参照を最後の : で分ける", () => {
    expect(parseRef("mcr.microsoft.com/playwright:v1.62.0-noble")).toEqual({
      image: "mcr.microsoft.com/playwright",
      tag: "v1.62.0-noble",
    });
  });

  it("既に付いている digest を捨てて読む", () => {
    expect(parseRef("alpine:3.24@sha256:abc")).toEqual({ image: "alpine", tag: "3.24" });
  });

  // ----- 異常系 -----
  it("tag を持たない参照を対象外にする", () => {
    expect(parseRef("scratch")).toBeNull();
  });

  it("tag が空の参照を対象外にする", () => {
    expect(parseRef("alpine:")).toBeNull();
  });

  it("最後の : が registry のポートだった参照を対象外にする", () => {
    expect(parseRef("localhost:5000/app")).toBeNull();
  });
});

describe("targetFiles", () => {
  // ----- 正常系 -----
  it("compose ファイルと docker 配下の Dockerfile を集める", () => {
    write("docker-compose.dev-tools.yml", "");
    write("docker-compose.docs.yaml", "");
    write("docker/tools/Dockerfile", "");

    expect(targetFiles(root).map((target) => target.file)).toEqual([
      join(root, "docker-compose.dev-tools.yml"),
      join(root, "docker-compose.docs.yaml"),
      join(root, "docker/tools/Dockerfile"),
    ]);
  });

  it("compose には image、Dockerfile には FROM、workflow には uses のパターンを割り当てる", () => {
    write("docker-compose.dev-tools.yml", "");
    write("docker/tools/Dockerfile", "");
    write(".github/workflows/test.yaml", "");

    expect(targetFiles(root).map((target) => target.pattern)).toEqual([
      usesDockerPattern(),
      composeImagePattern(),
      dockerfileFromPattern(),
    ]);
  });

  it("workflow 定義と composite action 定義を対象に含める", () => {
    write(".github/workflows/test.yaml", "");
    write(".github/workflows/lint.yml", "");
    write(".github/actions/setup/action.yml", "");

    expect(targetFiles(root).map((target) => target.file)).toEqual([
      join(root, ".github/actions/setup/action.yml"),
      join(root, ".github/workflows/lint.yml"),
      join(root, ".github/workflows/test.yaml"),
    ]);
  });

  it("走査対象ごとにパターンの実体を分け lastIndex を共有しない", () => {
    write(".github/workflows/test.yaml", "");
    write(".github/workflows/lint.yml", "");

    const [first, second] = targetFiles(root).map((target) => target.pattern);

    expect(first).not.toBe(second);
  });

  // ----- 異常系 -----
  it("compose でない YAML と、拡張子違いの compose を対象にしない", () => {
    write("compose.yml", "");
    write("docker-compose.dev-tools.json", "");

    expect(targetFiles(root)).toEqual([]);
  });

  it("docker 配下でも Dockerfile 以外の名前は対象にしない", () => {
    write("docker/tools/entrypoint.sh", "");

    expect(targetFiles(root)).toEqual([]);
  });

  it("docker 配下の直下ファイルを対象にしない", () => {
    write("docker/images-pin.toml", "");

    expect(targetFiles(root)).toEqual([]);
  });

  it("workflow ディレクトリの YAML 以外を対象にしない", () => {
    write(".github/workflows/README.md", "");

    expect(targetFiles(root)).toEqual([]);
  });

  it("workflow ディレクトリ直下のディレクトリを対象にしない", () => {
    mkdirSync(join(root, ".github", "workflows", "nested.yaml"), { recursive: true });

    expect(targetFiles(root)).toEqual([]);
  });

  it("ディレクトリが無ければ空を返す", () => {
    expect(targetFiles(join(root, "不在"))).toEqual([]);
  });
});

describe("composeImagePattern", () => {
  // ----- 正常系 -----
  it("image 行を接頭辞・参照・接尾辞へ割る", () => {
    const matches = [..."    image: alpine:3.24 # 開発補助\n".matchAll(composeImagePattern())];

    expect(matches[0]?.slice(1, 4)).toEqual(["    image: ", "alpine:3.24", " # 開発補助"]);
  });

  // ----- 異常系 -----
  it("引用符付きの image 行に一致しない", () => {
    expect([...'    image: "alpine:3.24"\n'.matchAll(composeImagePattern())]).toEqual([]);
  });

  it("進めた lastIndex を次の呼び出しへ持ち越さない", () => {
    const source = "    image: alpine:3.24\n    image: node:24-alpine\n";
    composeImagePattern().exec(source);

    expect([...source.matchAll(composeImagePattern())]).toHaveLength(2);
  });
});

describe("dockerfileFromPattern", () => {
  // ----- 正常系 -----
  it("FROM 行を接頭辞・参照・接尾辞へ割る", () => {
    const matches = [..."FROM alpine:3.24 AS base\n".matchAll(dockerfileFromPattern())];

    expect(matches[0]?.slice(1, 4)).toEqual(["FROM ", "alpine:3.24", " AS base"]);
  });

  it("platform 指定を接頭辞の外へ置いて参照だけを取り出す", () => {
    const matches = [
      ..."FROM --platform=linux/amd64 alpine:3.24\n".matchAll(dockerfileFromPattern()),
    ];

    expect(matches[0]?.[2]).toBe("alpine:3.24");
  });

  // ----- 異常系 -----
  it("進めた lastIndex を次の呼び出しへ持ち越さない", () => {
    const source = "FROM alpine:3.24 AS base\nFROM node:24-alpine\n";
    dockerfileFromPattern().exec(source);

    expect([...source.matchAll(dockerfileFromPattern())]).toHaveLength(2);
  });
});

describe("usesDockerPattern", () => {
  // ----- 正常系 -----
  it("uses: docker:// 行を接頭辞・参照・接尾辞へ割る", () => {
    const matches = [
      ..."      - uses: docker://alpine:3.24 # 補助\n".matchAll(usesDockerPattern()),
    ];

    expect(matches[0]?.slice(1, 4)).toEqual(["      - uses: docker://", "alpine:3.24", " # 補助"]);
  });

  it("digest を参照側へ取り込み接尾辞へ残さない", () => {
    const digest = `sha256:${"0".repeat(64)}`;
    const matches = [
      ...`      - uses: docker://alpine:3.24@${digest}\n`.matchAll(usesDockerPattern()),
    ];

    expect(matches[0]?.[2]).toBe(`alpine:3.24@${digest}`);
  });

  // ----- 異常系 -----
  it("tag を持たない参照に一致しない", () => {
    expect([..."      - uses: docker://alpine\n".matchAll(usesDockerPattern())]).toEqual([]);
  });

  it("registry のポート指定だけで tag を持たない参照に一致しない", () => {
    expect([
      ..."      - uses: docker://localhost:5000/app\n".matchAll(usesDockerPattern()),
    ]).toEqual([]);
  });

  it("owner/repo 形式の uses に一致しない", () => {
    expect([..."      - uses: actions/checkout@v7\n".matchAll(usesDockerPattern())]).toEqual([]);
  });

  it("進めた lastIndex を次の呼び出しへ持ち越さない", () => {
    const source = "      - uses: docker://alpine:3.24\n      - uses: docker://busybox:1.37\n";
    usesDockerPattern().exec(source);

    expect([...source.matchAll(usesDockerPattern())]).toHaveLength(2);
  });
});

describe("collectRefs", () => {
  // ----- 正常系 -----
  it("compose と Dockerfile の参照をキー単位で畳んで集める", () => {
    write("docker-compose.dev-tools.yml", "services:\n  a:\n    image: alpine:3.24\n");
    write("docker/tools/Dockerfile", "FROM alpine:3.24 AS base\nFROM node:24-alpine\n");

    expect([...collectRefs(targetFiles(root)).keys()]).toEqual(["alpine:3.24", "node:24-alpine"]);
  });

  it("platform 指定付きの FROM から参照を取り出す", () => {
    write("docker/tools/Dockerfile", "FROM --platform=linux/amd64 alpine:3.24\n");

    expect([...collectRefs(targetFiles(root)).keys()]).toEqual(["alpine:3.24"]);
  });

  it("workflow の uses: docker:// から参照を取り出す", () => {
    write(".github/workflows/test.yaml", "      - uses: docker://alpine:3.24\n");

    expect([...collectRefs(targetFiles(root)).keys()]).toEqual(["alpine:3.24"]);
  });

  it("digest 固定済みの uses: docker:// からも tag 側を版として取り出す", () => {
    write(
      ".github/workflows/test.yaml",
      `      - uses: docker://alpine:3.24@sha256:${"0".repeat(64)}\n`,
    );

    expect([...collectRefs(targetFiles(root)).keys()]).toEqual(["alpine:3.24"]);
  });

  it("registry を持つ uses: docker:// から参照を取り出す", () => {
    write(".github/workflows/test.yaml", "      - uses: docker://ghcr.io/owner/app:1.0.0\n");

    expect([...collectRefs(targetFiles(root)).keys()]).toEqual(["ghcr.io/owner/app:1.0.0"]);
  });

  // ----- 異常系 -----
  it("tag を持たないビルドステージ参照を集めない", () => {
    write("docker/tools/Dockerfile", "FROM alpine:3.24 AS base\nFROM base AS final\n");

    expect([...collectRefs(targetFiles(root)).keys()]).toEqual(["alpine:3.24"]);
  });

  it("uses: owner/repo@ref を集めない", () => {
    write(".github/workflows/test.yaml", "      - uses: actions/checkout@v7\n");

    expect([...collectRefs(targetFiles(root)).keys()]).toEqual([]);
  });
});

describe("unparsedLines", () => {
  const target = (): PinTarget => {
    const [first] = targetFiles(root);
    if (first === undefined) {
      throw new Error("走査対象のファイルが置かれていません");
    }
    return first;
  };

  // ----- 正常系 -----
  it("解釈できた参照を取りこぼしとして数えない", () => {
    write("docker-compose.dev-tools.yml", "services:\n  a:\n    image: alpine:3.24\n");

    expect(unparsedLines("services:\n  a:\n    image: alpine:3.24\n", target())).toEqual([]);
  });

  // ----- 異常系 -----
  it("引用符付きで書かれた compose の image を取りこぼしとして報告する", () => {
    write("docker-compose.dev-tools.yml", "");

    expect(unparsedLines('services:\n  a:\n    image: "alpine:3.24"\n', target())).toEqual([3]);
  });

  it("行全体がコメントなら反応しない", () => {
    write("docker-compose.dev-tools.yml", "");

    expect(unparsedLines('  # image: "alpine:3.24"\n', target())).toEqual([]);
  });

  it("解釈できない FROM を取りこぼしとして報告する", () => {
    write("docker/tools/Dockerfile", "");

    expect(unparsedLines('FROM "alpine:3.24" AS base extra\n', target())).toEqual([1]);
  });

  it("tag を持たない compose の image を取りこぼしとして報告する", () => {
    write("docker-compose.dev-tools.yml", "");

    expect(unparsedLines("services:\n  a:\n    image: alpine\n", target())).toEqual([3]);
  });

  it("registry ポートを tag と誤認する compose の image を取りこぼしとして報告する", () => {
    write("docker-compose.dev-tools.yml", "");

    expect(unparsedLines("services:\n  a:\n    image: localhost:5000/app\n", target())).toEqual([
      3,
    ]);
  });

  it("記法違反と tag 無しが混ざっても行番号順に返す", () => {
    write("docker-compose.dev-tools.yml", "");
    const source = ["services:", "  a:", "    image: alpine", "  b:", '    image: "node:24"'].join(
      "\n",
    );

    expect(unparsedLines(source, target())).toEqual([3, 5]);
  });

  it("tag を持たない Dockerfile の FROM を取りこぼしとして報告する", () => {
    write("docker/tools/Dockerfile", "");

    expect(unparsedLines("FROM alpine\n", target())).toEqual([1]);
  });

  it("宣言済みのビルドステージを参照する FROM は報告しない", () => {
    write("docker/tools/Dockerfile", "");

    expect(unparsedLines("FROM alpine:3.24 AS base\nFROM base AS final\n", target())).toEqual([]);
  });

  it("ビルドステージ名の大文字小文字が違っても報告しない", () => {
    write("docker/tools/Dockerfile", "");

    expect(unparsedLines("FROM alpine:3.24 AS Base\nFROM base\n", target())).toEqual([]);
  });

  it("scratch を参照する FROM は報告しない", () => {
    write("docker/tools/Dockerfile", "");

    expect(unparsedLines("FROM scratch\n", target())).toEqual([]);
  });

  it("tag を持たない uses: docker:// を取りこぼしとして報告する", () => {
    write(".github/workflows/test.yaml", "");

    expect(unparsedLines("      - uses: docker://alpine\n", target())).toEqual([1]);
  });

  it("引用符付きの uses: docker:// を取りこぼしとして報告する", () => {
    write(".github/workflows/test.yaml", "");

    expect(unparsedLines('      - uses: "docker://alpine:3.24"\n', target())).toEqual([1]);
  });

  it("flow mapping で書かれた uses: docker:// を取りこぼしとして報告する", () => {
    write(".github/workflows/test.yaml", "");

    expect(unparsedLines("      - {name: X, uses: docker://alpine:3.24}\n", target())).toEqual([1]);
  });

  it("uses: owner/repo@ref を取りこぼしとして報告しない", () => {
    write(".github/workflows/test.yaml", "");

    expect(unparsedLines("      - uses: actions/checkout@v7\n", target())).toEqual([]);
  });

  it("run スクリプトが出力する uses: docker:// を取りこぼしとして報告しない", () => {
    write(".github/workflows/test.yaml", "");
    const source = ["steps:", "  - run: |", '      echo "- uses: docker://alpine:3.24"', ""].join(
      "\n",
    );

    expect(unparsedLines(source, target())).toEqual([]);
  });

  it("ブロックが終わった後の uses: docker:// は取りこぼしとして報告する", () => {
    write(".github/workflows/test.yaml", "");
    const source = [
      "steps:",
      "  - run: |",
      '      echo "- uses: docker://alpine:3.24"',
      "  - uses: docker://busybox",
      "",
    ].join("\n");

    expect(unparsedLines(source, target())).toEqual([4]);
  });
});

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyPins, rewritePins } from "./apply-check";
import { type PinTarget, targetFiles } from "./image-reference";

const DIGEST = `sha256:${"a".repeat(64)}`;
const OTHER_DIGEST = `sha256:${"b".repeat(64)}`;

const COMPOSE = "docker-compose.dev-tools.yml";
const UNPINNED = `services:\n  a:\n    image: alpine:3.24\n`;
const PINNED = `services:\n  a:\n    image: alpine:3.24@${DIGEST}\n`;

let root: string;

/** リポジトリ相対のパスへ内容を書く。途中のディレクトリも作る。 */
function write(relative: string, content: string): void {
  const file = join(root, relative);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content);
}

/** 走査対象の 1 件目。テストは 1 ファイルだけを置いて呼ぶ。 */
function firstTarget(): PinTarget {
  const [target] = targetFiles(root);
  if (target === undefined) {
    throw new Error("走査対象のファイルが置かれていません");
  }
  return target;
}

const lock = (entries: [string, string][]) => new Map(entries);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "images-pin-apply-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("rewritePins", () => {
  // ----- 正常系 -----
  it("参照を digest 付きへ固定する", () => {
    write(COMPOSE, UNPINNED);

    const result = rewritePins(UNPINNED, firstTarget(), lock([["alpine:3.24", DIGEST]]));

    expect(result.out).toBe(PINNED);
    expect(result.referenced).toEqual(["alpine:3.24"]);
  });

  it("既に固定された参照をロックファイルの値へ揃える", () => {
    write(COMPOSE, PINNED);

    const result = rewritePins(PINNED, firstTarget(), lock([["alpine:3.24", OTHER_DIGEST]]));

    expect(result.out).toContain(`alpine:3.24@${OTHER_DIGEST}`);
  });

  it("行末のコメントを保つ", () => {
    write(COMPOSE, UNPINNED);
    const data = "services:\n  a:\n    image: alpine:3.24 # 補助ツール\n";

    const result = rewritePins(data, firstTarget(), lock([["alpine:3.24", DIGEST]]));

    expect(result.out).toContain(`alpine:3.24@${DIGEST} # 補助ツール`);
  });

  // ----- 異常系 -----
  it("ロックファイルに無い参照を未登録として報告し、行は書き換えない", () => {
    write(COMPOSE, UNPINNED);

    const result = rewritePins(UNPINNED, firstTarget(), lock([]));

    expect(result.missing).toEqual(["alpine:3.24"]);
    expect(result.out).toBe(UNPINNED);
  });

  it("tag を持たない参照を素通しする", () => {
    write("docker/tools/Dockerfile", "");
    const data = "FROM base AS final\n";

    const result = rewritePins(data, firstTarget(), lock([]));

    expect(result.out).toBe(data);
    expect(result.referenced).toEqual([]);
  });
});

describe("applyPins", () => {
  // ----- 正常系 -----
  it("固定した内容をファイルへ書き戻す", () => {
    write(COMPOSE, UNPINNED);

    const report = applyPins(root, targetFiles(root), lock([["alpine:3.24", DIGEST]]), false);

    expect(report.updated).toEqual([COMPOSE]);
    expect(readFileSync(join(root, COMPOSE), "utf8")).toBe(PINNED);
  });

  it("固定済みなら書き換えない", () => {
    write(COMPOSE, PINNED);

    const report = applyPins(root, targetFiles(root), lock([["alpine:3.24", DIGEST]]), false);

    expect(report.updated).toEqual([]);
  });

  it("検証だけの実行では書き換えずに未固定を報告する", () => {
    write(COMPOSE, UNPINNED);

    const report = applyPins(root, targetFiles(root), lock([["alpine:3.24", DIGEST]]), true);

    expect(report.drifted).toEqual([COMPOSE]);
    expect(readFileSync(join(root, COMPOSE), "utf8")).toBe(UNPINNED);
  });

  // ----- 異常系 -----
  it("未登録があれば 1 ファイルも書き換えない", () => {
    write(COMPOSE, UNPINNED);
    write("docker-compose.docs.yaml", "services:\n  b:\n    image: nginx:1.31\n");

    const report = applyPins(root, targetFiles(root), lock([["alpine:3.24", DIGEST]]), false);

    expect(report.missing).toEqual(["nginx:1.31"]);
    expect(report.updated).toEqual([]);
    expect(readFileSync(join(root, COMPOSE), "utf8")).toBe(UNPINNED);
  });

  it("どこからも参照されないロックファイルのエントリを孤児として報告する", () => {
    write(COMPOSE, PINNED);

    const report = applyPins(
      root,
      targetFiles(root),
      lock([
        ["alpine:3.24", DIGEST],
        ["nginx:1.31", OTHER_DIGEST],
      ]),
      true,
    );

    expect(report.orphans).toEqual(["nginx:1.31"]);
  });

  it("解釈できない記法を位置付きで報告し、書き換えを止める", () => {
    write(COMPOSE, 'services:\n  a:\n    image: "alpine:3.24"\n');

    const report = applyPins(root, targetFiles(root), lock([]), false);

    expect(report.unparsed).toEqual([`${COMPOSE}:3`]);
    expect(report.updated).toEqual([]);
  });
});

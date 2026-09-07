import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LineCounter } from "yaml";

import {
  listWorkflowFiles,
  parseWorkflowDocument,
  readJobId,
  readWorkflowMaps,
  selectWorkflowFiles,
  WORKFLOW_DIR,
} from "./workflow-files";

let root: string;

/** `<root>/.github/workflows/<name>` を置く。 */
function placeWorkflow(name: string, body = ""): void {
  const dir = join(root, WORKFLOW_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), body);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "workflow-files-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("WORKFLOW_DIR", () => {
  // ----- 正常系 -----
  it("ワークフロー定義の置き場をリポジトリルート相対で示す", () => {
    expect(WORKFLOW_DIR).toBe(".github/workflows");
  });
});

describe("selectWorkflowFiles", () => {
  // ----- 正常系 -----
  it("yaml と yml だけを、ディレクトリを冠したパスの順に並べて返す", () => {
    expect(selectWorkflowFiles(".github/workflows", ["test.yaml", "build.yml"])).toEqual([
      ".github/workflows/build.yml",
      ".github/workflows/test.yaml",
    ]);
  });

  it("何も無いディレクトリを空で返す", () => {
    expect(selectWorkflowFiles(".github/workflows", [])).toEqual([]);
  });

  // ----- 異常系 -----
  it("ワークフロー定義でない名前を、拡張子を持たないものも含めて外す", () => {
    expect(
      selectWorkflowFiles(".github/workflows", [
        "README.md",
        "notes",
        "lint.yaml.bak",
        "lint.yaml",
      ]),
    ).toEqual([".github/workflows/lint.yaml"]);
  });
});

describe("listWorkflowFiles", () => {
  // ----- 正常系 -----
  it("yaml と yml の定義をリポジトリ相対パスで名前順に返す", () => {
    placeWorkflow("b.yml");
    placeWorkflow("a.yaml");

    expect(listWorkflowFiles(root)).toEqual([`${WORKFLOW_DIR}/a.yaml`, `${WORKFLOW_DIR}/b.yml`]);
  });

  it("ディレクトリが無ければ空を返す", () => {
    expect(listWorkflowFiles(root)).toEqual([]);
  });

  it("ディレクトリを候補に数えない", () => {
    mkdirSync(join(root, WORKFLOW_DIR, "nested.yaml"), { recursive: true });

    expect(listWorkflowFiles(root)).toEqual([]);
  });

  // ----- 異常系 -----
  it("ワークフロー以外の拡張子を返さない", () => {
    placeWorkflow("README.md");

    expect(listWorkflowFiles(root)).toEqual([]);
  });
});

describe("parseWorkflowDocument", () => {
  // ----- 正常系 -----
  it("読める YAML を Document として返す", () => {
    const doc = parseWorkflowDocument("w.yaml", "jobs:\n  build:\n    runs-on: ubuntu-latest\n");

    expect(doc.toJS()).toEqual({ jobs: { build: { "runs-on": "ubuntu-latest" } } });
  });

  it("行数え器を渡すと、位置をソースの行へ写せる形で読む", () => {
    const lineCounter = new LineCounter();
    parseWorkflowDocument("w.yaml", "jobs:\n  build:\n", lineCounter);

    expect(lineCounter.lineStarts).toEqual([0, 6, 15]);
  });

  // ----- 異常系 -----
  it("YAML として読めない入力にファイル名を添えて投げる", () => {
    expect(() => parseWorkflowDocument("w.yaml", "jobs:\n  - a\n b: c\n")).toThrow(
      /^w\.yaml: YAML として読めません: /,
    );
  });
});

describe("readWorkflowMaps", () => {
  // ----- 正常系 -----
  it("ルートと jobs: をマッピングとして取り出す", () => {
    const doc = parseWorkflowDocument("w.yaml", "on:\n  pull_request:\njobs:\n  lint:\n  build:\n");
    const maps = readWorkflowMaps("w.yaml", doc);

    expect([maps.root.items.length, maps.jobs.items.length]).toEqual([2, 2]);
  });

  // ----- 異常系 -----
  it("マッピングでないワークフローを落とす", () => {
    const doc = parseWorkflowDocument("w.yaml", "- lint");

    expect(() => readWorkflowMaps("w.yaml", doc)).toThrow(
      "w.yaml: ワークフローがマッピングとして読めません",
    );
  });

  it("jobs: が読めないワークフローを、job 0 件へ寄せずに落とす", () => {
    const doc = parseWorkflowDocument("w.yaml", "on:\n  pull_request:\n");

    expect(() => readWorkflowMaps("w.yaml", doc)).toThrow(
      "w.yaml: jobs: がマッピングとして読めません",
    );
  });
});

describe("readJobId", () => {
  // ----- 正常系 -----
  it("jobs: のキーを job の ID として読む", () => {
    const doc = parseWorkflowDocument("w.yaml", "jobs:\n  lint:\n");

    expect(readJobId("w.yaml", readWorkflowMaps("w.yaml", doc).jobs.items[0]?.key)).toBe("lint");
  });

  // ----- 異常系 -----
  it("文字列でないキーを落とす", () => {
    const doc = parseWorkflowDocument("w.yaml", "jobs:\n  2026:\n");

    expect(() => readJobId("w.yaml", readWorkflowMaps("w.yaml", doc).jobs.items[0]?.key)).toThrow(
      "w.yaml: ジョブ名が文字列として読めません",
    );
  });

  it("スカラーでないキーを落とす", () => {
    expect(() => readJobId("w.yaml", { value: "lint" })).toThrow(
      "w.yaml: ジョブ名が文字列として読めません",
    );
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { COMMENT_BORNE_SOURCES, scanSuppressions } from "./scan";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "suppression-expiry-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function place(relativePath: string, contents: string): void {
  const absolute = join(root, relativePath);

  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}

describe("scanSuppressions", () => {
  // ----- 正常系: 条件をデータとして持つ面 -----
  it("脆弱性 ID の抑止を、理由ごと読む（osv-scanner）", () => {
    place(
      "osv-scanner.toml",
      '[[IgnoredVulns]]\nid = "GHSA-1111"\nreason = "2026-08-02 以降に削除する。"\n',
    );

    expect(scanSuppressions(root)).toEqual([
      {
        source: "osv-scanner.toml",
        subject: "GHSA-1111",
        condition: "2026-08-02 以降に削除する。",
      },
    ]);
  });

  it("角括弧の内側に空白があっても読む。TOML として合法な書き方である", () => {
    // 位置を数える実装はここで黙って 0 件を返し、期限切れが誰にも見えなくなる。
    place("osv-scanner.toml", '[[ IgnoredVulns ]]\nid = "GHSA-2222"\nreason = "理由"\n');

    expect(scanSuppressions(root)).toEqual([
      { source: "osv-scanner.toml", subject: "GHSA-2222", condition: "理由" },
    ]);
  });

  it("理由の中でエスケープされた引用符が、値を途中で切らない", () => {
    // 切れると期限の日付が消え、満了しても永久に検出できない側へ倒れる。
    place(
      "osv-scanner.toml",
      '[[IgnoredVulns]]\nid = "GHSA-3333"\nreason = "\\"foo\\" の件。2020-01-01 以降に削除する。"\n',
    );

    expect(scanSuppressions(root)[0]?.condition).toContain("2020-01-01");
  });

  it("脆弱性 ID の抑止を、理由ごと読む（trivy）", () => {
    place(
      ".trivyignore.yaml",
      'vulnerabilities:\n  - id: CVE-2026-0001\n    statement: "2026-08-02 以降に削除する"\n',
    );

    expect(scanSuppressions(root)).toEqual([
      {
        source: ".trivyignore.yaml",
        subject: "CVE-2026-0001",
        condition: "2026-08-02 以降に削除する",
      },
    ]);
  });

  it("検出 1 件ごとの抑止を、理由ごと読む（bearer）", () => {
    place("bearer.ignore", '{"abc_0": {"comment": "撤回条件: 秘密を読むようになったとき。"}}');

    expect(scanSuppressions(root)).toEqual([
      {
        source: "bearer.ignore",
        subject: "abc_0",
        condition: "撤回条件: 秘密を読むようになったとき。",
      },
    ]);
  });

  it("動的スキャンの抑止を、規則番号と理由の組で読む", () => {
    place(".github/zap/rules.tsv", "# 解説の行\n10055\tIGNORE\t既知の弱い許可。\n");

    expect(scanSuppressions(root)).toEqual([
      { source: ".github/zap/rules.tsv", subject: "10055", condition: "既知の弱い許可。" },
    ]);
  });

  // ----- 正常系: 条件をコメントとして持つ面 -----
  it("コメントに条件を持つ面からは、日付を含む行だけを拾う", () => {
    place(
      "pnpm-workspace.yaml",
      "minimumReleaseAgeExclude:\n  - pkg@1.2.3 # 2026-08-02 以降に削除する\noverrides:\n  # ajv が 3.1.6 以上を要求したら撤去する。\n",
    );

    expect(scanSuppressions(root)).toEqual([
      {
        source: "pnpm-workspace.yaml",
        subject: "L2",
        condition: "- pkg@1.2.3 # 2026-08-02 以降に削除する",
      },
    ]);
  });

  it("コメントに条件を持つ面は、pnpm-workspace.yaml 以外も同じ形で読む", () => {
    place(".github/zizmor.yml", "rules:\n  # 2026-08-02 以降に外す。\n  github-app:\n");

    expect(scanSuppressions(root)).toEqual([
      { source: ".github/zizmor.yml", subject: "L2", condition: "# 2026-08-02 以降に外す。" },
    ]);
  });

  it("面をまたいで 1 つの一覧へ均す", () => {
    place("osv-scanner.toml", '[[IgnoredVulns]]\nid = "GHSA-1"\nreason = "理由"\n');
    place("bearer.ignore", '{"f_0": {"comment": "理由"}}');
    place(".github/zap/rules.tsv", "10055\tIGNORE\t理由\n");

    expect(scanSuppressions(root).map((entry) => entry.source)).toEqual([
      "osv-scanner.toml",
      "bearer.ignore",
      ".github/zap/rules.tsv",
    ]);
  });

  it("面が 1 つも無ければ空を返す。読み取りは不在を正規に空へ倒す", () => {
    expect(scanSuppressions(root)).toEqual([]);
  });

  // ----- 異常系 -----
  it("理由を持たない宣言も、条件を空にして一覧へ載せる", () => {
    // 読み飛ばすと、条件を持たない抑止だけが一覧から消え、いちばん確かめたいものが見えなくなる。
    place("osv-scanner.toml", '[[IgnoredVulns]]\nid = "GHSA-4444"\n');
    place("bearer.ignore", '{"f_0": {}}');

    expect(scanSuppressions(root).map((entry) => entry.condition)).toEqual(["", ""]);
  });

  it("名前を持たない宣言も、名前の不在を見せて一覧へ載せる", () => {
    place("osv-scanner.toml", '[[IgnoredVulns]]\nreason = "理由"\n');
    place(".trivyignore.yaml", "vulnerabilities:\n  - statement: 理由\n");

    expect(scanSuppressions(root).map((entry) => entry.subject)).toEqual([
      "(id なし)",
      "(id なし)",
    ]);
  });

  it("理由を持たない trivy の宣言も、条件を空にして一覧へ載せる", () => {
    place(".trivyignore.yaml", "vulnerabilities:\n  - id: CVE-2026-0002\n");

    expect(scanSuppressions(root)).toEqual([
      { source: ".trivyignore.yaml", subject: "CVE-2026-0002", condition: "" },
    ]);
  });

  it("列を持たない行も、規則番号だけの宣言として読む", () => {
    place(".github/zap/rules.tsv", "10055\n");

    expect(scanSuppressions(root)).toEqual([
      { source: ".github/zap/rules.tsv", subject: "10055", condition: "" },
    ]);
  });

  it("規則番号を持たない行は落とす。何を確かめるか決められない", () => {
    place(".github/zap/rules.tsv", "\tIGNORE\t理由\n");

    expect(scanSuppressions(root)).toEqual([]);
  });

  it("形式として壊れている面は空として扱い、他の面の点検を止めない", () => {
    // 1 つの面のせいで週次の点検が止まると、他の面の期限まで見られなくなる。
    place("osv-scanner.toml", "[[IgnoredVulns\nid = ");
    place("bearer.ignore", "{壊れた JSON");
    place(".trivyignore.yaml", "vulnerabilities: [\n");
    place(".github/zap/rules.tsv", "10055\tIGNORE\t理由\n");

    expect(scanSuppressions(root)).toEqual([
      { source: ".github/zap/rules.tsv", subject: "10055", condition: "理由" },
    ]);
  });

  it("根を渡さなければ、自分が置かれているリポジトリを読む", () => {
    // 既定の根は入口だけが使う。ここで踏まないと、実行される経路が検査の外に残る。
    // 件数や特定の面で見ると、抑止が撤去された将来にこの検査だけが落ちる —— 見ているのが
    // コードではなく実データになる。既定の根が指す先そのものを、明示した根と突き合わせる。
    expect(scanSuppressions()).toEqual(scanSuppressions(join(import.meta.dirname, "../..")));
  });
});

describe("COMMENT_BORNE_SOURCES", () => {
  // ----- 正常系 -----
  it("宣言単位では読めない面を名指しできる", () => {
    // 報告がこの一覧を出すことで、見えていない範囲が読む人に伝わる。
    expect(COMMENT_BORNE_SOURCES).toContain("pnpm-workspace.yaml");
    expect(COMMENT_BORNE_SOURCES).toContain(".github/zizmor.yml");
  });
});

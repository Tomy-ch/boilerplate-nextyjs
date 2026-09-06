import { describe, expect, it, vi } from "vitest";

import {
  deriveVersion,
  isStampMode,
  planStamp,
  readVersion,
  replaceVersion,
  reportPlan,
  selectRef,
  stampCommitMessage,
  stampEffects,
} from "./version";

const manifest = [
  "{",
  '  "name": "nextjs-boilerplate",',
  '  "version": "0.5.0",',
  '  "private": true',
  "}",
].join("\n");

describe("isStampMode", () => {
  // ----- 正常系 -----
  it("stamp / commit / check を走らせ方として受け入れる", () => {
    expect(isStampMode("stamp")).toBe(true);
    expect(isStampMode("commit")).toBe(true);
    expect(isStampMode("check")).toBe(true);
  });

  // ----- 異常系 -----
  it("走らせ方でない指定を拒否する", () => {
    expect(isStampMode("apply")).toBe(false);
    expect(isStampMode("")).toBe(false);
  });
});

describe("stampEffects", () => {
  // ----- 正常系 -----
  it("突き合わせるだけの走らせ方では書き換えない", () => {
    expect(stampEffects("check")).toEqual({ write: false, commit: false });
  });

  it("書く走らせ方では、書き換えるが記録は残さない", () => {
    expect(stampEffects("stamp")).toEqual({ write: true, commit: false });
  });

  it("記録まで行う走らせ方では、書き換えてコミットする", () => {
    expect(stampEffects("commit")).toEqual({ write: true, commit: true });
  });
});

describe("selectRef", () => {
  // ----- 正常系 -----
  it("先に並べた候補を優先する", () => {
    expect(selectRef(["release/v1.0.0", "release/v2.0.0"])).toBe("release/v1.0.0");
  });

  it("指定されていない候補を飛ばして次を採る", () => {
    expect(selectRef([undefined, "", "  ", "release/v2.0.0"])).toBe("release/v2.0.0");
  });

  it("端の空白を落として返す", () => {
    expect(selectRef([" release/v1.0.0\n"])).toBe("release/v1.0.0");
  });

  // ----- 異常系 -----
  it("どこにも指定が無ければ null を返す", () => {
    expect(selectRef([undefined, ""])).toBeNull();
    expect(selectRef([])).toBeNull();
  });
});

describe("stampCommitMessage", () => {
  // ----- 正常系 -----
  it("コミット規約の接頭辞を付けて版を名乗る", () => {
    expect(stampCommitMessage("1.3.0")).toBe("Chore: package.json の version を 1.3.0 に合わせる");
  });
});

describe("deriveVersion", () => {
  // ----- 正常系 -----
  it("release ブランチから版を読む", () => {
    expect(deriveVersion("release/v1.2.3")).toBe("1.2.3");
  });

  it("hotfix ブランチも出荷される版として数える", () => {
    expect(deriveVersion("hotfix/v1.2.4")).toBe("1.2.4");
  });

  // ----- 異常系 -----
  it("リリース版を名乗らないブランチでは版を出さない", () => {
    expect(deriveVersion("feature/123-add-login-form")).toBeNull();
    expect(deriveVersion("production")).toBeNull();
  });

  it("接頭辞だけ一致するブランチを拾わない", () => {
    expect(deriveVersion("release-notes/v1.2.3")).toBeNull();
  });

  it("リリース版を名乗る綴りが ref の途中に埋め込まれているだけでは拾わない", () => {
    expect(deriveVersion("prerelease/v1.0.0")).toBeNull();
    expect(deriveVersion("not-a-hotfix/v1.0.0")).toBeNull();
  });

  it("v を伴わない版表記を拾わない", () => {
    expect(deriveVersion("release/1.2.3")).toBeNull();
  });

  it("版として読めない末尾を拒否する", () => {
    expect(deriveVersion("release/v1.2")).toBeNull();
    expect(deriveVersion("release/v1.2.3-rc.1")).toBeNull();
  });
});

describe("readVersion", () => {
  // ----- 正常系 -----
  it("version の値だけを返す", () => {
    expect(readVersion(manifest)).toBe("0.5.0");
  });

  // ----- 異常系 -----
  it("version が無ければ null を返す", () => {
    expect(readVersion('{\n  "name": "nextjs-boilerplate"\n}')).toBeNull();
  });

  it("入れ子の version を最上位のものと取り違えない", () => {
    expect(readVersion('{\n  "engines": {\n    "version": "1.0.0"\n  }\n}')).toBeNull();
  });
});

describe("replaceVersion", () => {
  // ----- 正常系 -----
  it("version の値だけを差し替え、前後をそのまま残す", () => {
    expect(replaceVersion(manifest, "0.7.0")).toBe(
      [
        "{",
        '  "name": "nextjs-boilerplate",',
        '  "version": "0.7.0",',
        '  "private": true',
        "}",
      ].join("\n"),
    );
  });

  it("置換パターンを含む版を文字列としてそのまま書く", () => {
    expect(replaceVersion(manifest, "$&")).toBe(
      ["{", '  "name": "nextjs-boilerplate",', '  "version": "$&",', '  "private": true', "}"].join(
        "\n",
      ),
    );
  });
});

describe("planStamp", () => {
  // ----- 正常系 -----
  it("版が違えば差し替えた本文を持つ", () => {
    expect(planStamp("release/v0.7.0", () => manifest)).toEqual({
      kind: "write",
      from: "0.5.0",
      to: "0.7.0",
      content: replaceVersion(manifest, "0.7.0"),
    });
  });

  it("既に同じ版なら書き換えない", () => {
    expect(planStamp("release/v0.5.0", () => manifest)).toEqual({
      kind: "unchanged",
      version: "0.5.0",
    });
  });

  // ----- 異常系 -----
  it("リリース版を名乗らない ref では本文を読まない", () => {
    const read = vi.fn(() => manifest);

    expect(planStamp("develop", read)).toEqual({ kind: "skip", ref: "develop" });
    expect(read).not.toHaveBeenCalled();
  });

  it("version が無いことを、書き換え不要と区別する", () => {
    expect(planStamp("release/v0.7.0", () => "{}")).toEqual({ kind: "missing" });
  });
});

describe("reportPlan", () => {
  // ----- 正常系 -----
  it("書き込む側では、差し替えを仕事として報告する", () => {
    const report = reportPlan({ kind: "write", from: "0.5.0", to: "0.7.0", content: "" }, "stamp");

    expect(report).toEqual({ message: "✏️ version: 0.5.0 → 0.7.0", failed: false });
  });

  it("コミットまで行う側も、書き込む側と同じ文面を出す", () => {
    const report = reportPlan({ kind: "write", from: "0.5.0", to: "0.7.0", content: "" }, "commit");

    expect(report).toEqual({ message: "✏️ version: 0.5.0 → 0.7.0", failed: false });
  });

  it("一致していれば、どちらの走らせ方でも落とさない", () => {
    expect(reportPlan({ kind: "unchanged", version: "0.7.0" }, "check")).toEqual({
      message: "✅ version はブランチ名どおり 0.7.0 です",
      failed: false,
    });
  });

  it("対象外の ref は据え置きとして報告し、落とさない", () => {
    expect(reportPlan({ kind: "skip", ref: "develop" }, "check")).toEqual({
      message: "⏭️ develop はリリース版を名乗らないので version は据え置きます",
      failed: false,
    });
  });

  // ----- 異常系 -----
  it("突き合わせる側では、同じ差し替えを焼き込み忘れとして落とす", () => {
    const report = reportPlan({ kind: "write", from: "0.5.0", to: "0.7.0", content: "" }, "check");

    expect(report).toEqual({
      message: [
        "❌ version がブランチ名と食い違っています（package.json: 0.5.0 / ブランチ: 0.7.0）",
        "➡️ make version-stamp を実行し、差分をコミットしてください",
      ].join("\n"),
      failed: true,
    });
  });

  it("version が無ければ、書き込む側でも落とす", () => {
    expect(reportPlan({ kind: "missing" }, "stamp")).toEqual({
      message: "❌ package.json に version がありません",
      failed: true,
    });
  });
});

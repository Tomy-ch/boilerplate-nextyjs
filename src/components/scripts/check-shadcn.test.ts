import { beforeEach, describe, expect, it, vi } from "vitest";

const childProcess = vi.hoisted(() => ({ execFile: vi.fn() }));
vi.mock("node:child_process", () => childProcess);
const execFileMock = childProcess.execFile;

import {
  baselineUrl,
  checkExitCode,
  checkUpstreamDrift,
  collectComponentLayout,
  componentDirectoryOf,
  fetchJson,
  formatCheckResult,
  formatIntegrityProblems,
  packageOf,
  registryItemOf,
  storyHeadingOf,
  vendorImportsOf,
  verifyManifestIntegrity,
} from "./check-shadcn";

const RECORDED = "f31ed81983653919dd4fe77aee4b4859f610f1dc";
const LATEST = "9584703534041234567890123456789012345678";

function manifest(entries: string): string {
  return `schemaVersion: 1\ncomponents:\n${entries}`;
}

function copyInEntry(name: string, commit = RECORDED): string {
  return [
    `  ${name}:`,
    "    kind: copy-in",
    "    layer: design-system",
    "    as: display",
    `    registryItem: ${name}`,
    `    directory: src/components/design-system/display/${name}`,
    "    addedAt: 2026-08-02T01:06:43Z",
    "    source:",
    "      - repository: shadcn-ui/ui",
    `        path: apps/v4/registry/new-york-v4/ui/${name}.tsx`,
    `        localPath: src/components/design-system/display/${name}/${name}.tsx`,
    `        commit: ${commit}`,
    "        committedAt: 2026-03-02T08:49:00Z",
    "",
  ].join("\n");
}

function notAdoptedEntry(name: string): string {
  return [
    `  ${name}:`,
    "    kind: not-adopted",
    "    reason: 責務は既存の component が持つ",
    "    revisitWhen: 同じ形が複数画面で割れ始めたとき",
    "    decidedAt: 2026-08-05T00:00:00.000Z",
    "",
  ].join("\n");
}

function dirsOf(...names: string[]): string[] {
  return names.map((name) => `src/components/design-system/display/${name}`);
}

function filesOf(...names: string[]): ReadonlySet<string> {
  return new Set(names.map((name) => `src/components/design-system/display/${name}/${name}.tsx`));
}

function commitsBody(sha: string): unknown {
  return [{ sha, commit: { committer: { date: "2026-06-29T16:56:50Z" } } }];
}

beforeEach(() => {
  vi.unstubAllGlobals();
  execFileMock.mockReset();
});

describe("checkUpstreamDrift", () => {
  it("記録した commit と最新が同じなら差分として扱わない", async () => {
    const result = await checkUpstreamDrift(
      () => Promise.resolve(commitsBody(RECORDED)),
      manifest(copyInEntry("button")),
    );

    expect(result.checked).toBe(1);
    expect(result.drifted).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("上流が動いた component を、差分を読む情報とともに返す", async () => {
    const result = await checkUpstreamDrift(
      () => Promise.resolve(commitsBody(LATEST)),
      manifest(copyInEntry("button")),
    );

    expect(result.drifted).toEqual([
      {
        component: "button",
        kind: "copy-in",
        path: "apps/v4/registry/new-york-v4/ui/button.tsx",
        recorded: RECORDED,
        latest: LATEST,
        latestCommittedAt: "2026-06-29T16:56:50Z",
      },
    ]);
  });

  it("自前実装は上流を持たないため確認しない", async () => {
    const fetcher = vi.fn();
    const result = await checkUpstreamDrift(
      fetcher,
      manifest(
        "  text-highlight:\n    kind: original\n    layer: design-system\n    as: display\n    directory: src/components/design-system/display/text-highlight\n    addedAt: 2026-08-03T09:00:00Z\n",
      ),
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.checked).toBe(0);
    expect(result.skipped).toEqual(["text-highlight"]);
  });

  it("source を持たないエントリも確認しない", async () => {
    const fetcher = vi.fn();
    const result = await checkUpstreamDrift(
      fetcher,
      manifest(
        "  legacy:\n    kind: copy-in\n    layer: design-system\n    as: display\n    directory: src/components/design-system/display/legacy\n    addedAt: 2026-08-03T09:00:00Z\n",
      ),
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.skipped).toEqual(["legacy"]);
  });

  it("確認できなかったものは理由とともに残す", async () => {
    const result = await checkUpstreamDrift(
      () => Promise.reject(new Error("HTTP 403")),
      manifest(copyInEntry("button")),
    );

    expect(result.failed).toEqual(["button: HTTP 403"]);
  });

  it("Error ではない失敗も文字列として残す", async () => {
    const result = await checkUpstreamDrift(
      () => Promise.reject("rate limited"),
      manifest(copyInEntry("button")),
    );

    expect(result.failed).toEqual(["button: rate limited"]);
  });

  it("reimplemented も上流の変更を確認する", async () => {
    const source = copyInEntry("separator").replace("kind: copy-in", "kind: reimplemented");
    const result = await checkUpstreamDrift(
      () => Promise.resolve(commitsBody(LATEST)),
      manifest(source),
    );

    expect(result.drifted[0]?.kind).toBe("reimplemented");
  });

  it("not-adopted は追従先を持たないため確認しない", async () => {
    const result = await checkUpstreamDrift(
      () => Promise.reject(new Error("呼ばれてはいけない")),
      manifest(notAdoptedEntry("async-operation-state")),
    );

    expect(result.checked).toBe(0);
    expect(result.skipped).toEqual(["async-operation-state"]);
    expect(result.failed).toEqual([]);
  });
});

describe("baselineUrl", () => {
  it("記録した commit 時点の原本を指す URL を組み立てる", () => {
    expect(
      baselineUrl("shadcn-ui/ui", RECORDED, "apps/v4/registry/new-york-v4/ui/button.tsx"),
    ).toBe(
      `https://raw.githubusercontent.com/shadcn-ui/ui/${RECORDED}/apps/v4/registry/new-york-v4/ui/button.tsx`,
    );
  });
});

describe("formatCheckResult", () => {
  it("差分が無いことを明示する", () => {
    const text = formatCheckResult({
      checked: 3,
      skipped: ["media-image"],
      drifted: [],
      failed: [],
    });

    expect(text).toContain("確認: 3 件");
    expect(text).toContain("上流が動いた component はありません。");
  });

  it("copy-in は要追従、reimplemented は参考として区別する", () => {
    const text = formatCheckResult({
      checked: 2,
      skipped: [],
      drifted: [
        {
          component: "button",
          kind: "copy-in",
          path: "apps/v4/registry/new-york-v4/ui/button.tsx",
          recorded: RECORDED,
          latest: LATEST,
          latestCommittedAt: "2026-06-29T16:56:50Z",
        },
        {
          component: "separator",
          kind: "reimplemented",
          path: "apps/v4/registry/new-york-v4/ui/separator.tsx",
          recorded: RECORDED,
          latest: LATEST,
          latestCommittedAt: "2026-06-29T16:56:50Z",
        },
      ],
      failed: ["kbd: HTTP 403"],
    });

    expect(text).toContain("[要追従] button");
    expect(text).toContain("[参考] separator");
    expect(text).toContain("確認できなかったもの:");
    expect(text).toContain("kbd: HTTP 403");
  });
});

describe("fetchJson", () => {
  it("GitHub API の URL を gh の endpoint へ変換して呼ぶ", async () => {
    execFileMock.mockImplementation((_file, _args, callback) => {
      callback(null, { stdout: '[{"sha":"abc"}]', stderr: "" });
      return undefined;
    });

    await expect(
      fetchJson("https://api.github.com/repos/shadcn-ui/ui/commits?path=a.tsx&per_page=1"),
    ).resolves.toEqual([{ sha: "abc" }]);
    expect(execFileMock).toHaveBeenCalledWith(
      "gh",
      ["api", "repos/shadcn-ui/ui/commits?path=a.tsx&per_page=1"],
      expect.anything(),
    );
  });

  it("GitHub API 以外の URL はそのまま渡す", async () => {
    execFileMock.mockImplementation((_file, _args, callback) => {
      callback(null, { stdout: "{}", stderr: "" });
      return undefined;
    });

    await fetchJson("https://example.test/item.json");

    expect(execFileMock).toHaveBeenCalledWith(
      "gh",
      ["api", "https://example.test/item.json"],
      expect.anything(),
    );
  });
});

describe("checkExitCode", () => {
  const drift = {
    component: "button",
    kind: "copy-in",
    path: "apps/v4/registry/new-york-v4/ui/button.tsx",
    recorded: RECORDED,
    latest: LATEST,
    latestCommittedAt: "2026-06-29T16:56:50Z",
  } as const;

  it("差分も失敗も無ければ 0", () => {
    expect(checkExitCode({ checked: 1, skipped: [], drifted: [], failed: [] })).toBe(0);
  });

  it("上流が動いていれば 1", () => {
    expect(checkExitCode({ checked: 1, skipped: [], drifted: [drift], failed: [] })).toBe(1);
  });

  it("確認できなかったものがあれば 1", () => {
    expect(checkExitCode({ checked: 1, skipped: [], drifted: [], failed: ["kbd: HTTP 403"] })).toBe(
      1,
    );
  });
});

describe("verifyManifestIntegrity", () => {
  it("宣言どおりに実体があれば問題としない", () => {
    expect(
      verifyManifestIntegrity(dirsOf("button"), filesOf("button"), manifest(copyInEntry("button"))),
    ).toEqual([]);
  });

  it("not-adopted は実体を持たないため、失われたエントリとして扱わない", () => {
    const problems = verifyManifestIntegrity(
      dirsOf("button"),
      filesOf("button"),
      manifest(copyInEntry("button") + notAdoptedEntry("async-operation-state")),
    );

    expect(problems).toEqual([]);
  });

  it("記録の無いディレクトリを検出する", () => {
    const problems = verifyManifestIntegrity(
      dirsOf("button", "new-thing"),
      filesOf("button"),
      manifest(copyInEntry("button")),
    );

    expect(problems).toEqual([
      "src/components/design-system/display/new-thing: manifest に記録がありません。kind を決めてエントリを追加してください。",
    ]);
  });

  it("実体を失ったエントリを検出する", () => {
    const problems = verifyManifestIntegrity([], new Set(), manifest(copyInEntry("button")));

    expect(problems).toContain(
      "button: 宣言された src/components/design-system/display/button が存在しません。",
    );
  });

  it("同じディレクトリを二重に宣言したエントリを検出する", () => {
    const duplicate = copyInEntry("toggle-group").replace(
      "directory: src/components/design-system/display/toggle-group",
      "directory: src/components/design-system/display/button",
    );
    const problems = verifyManifestIntegrity(
      dirsOf("button"),
      filesOf("button"),
      manifest(copyInEntry("button") + duplicate),
    );

    expect(problems).toContain(
      "button / toggle-group: 同じ src/components/design-system/display/button を宣言しています。",
    );
  });

  it("localPath の実体が無いことを検出する", () => {
    const problems = verifyManifestIntegrity(
      dirsOf("button"),
      new Set(),
      manifest(copyInEntry("button")),
    );

    expect(problems).toContain(
      "button: source の localPath src/components/design-system/display/button/button.tsx が存在しません。",
    );
  });

  it("kind と source の食い違いを検出する", () => {
    const noSource = [
      "  legacy:",
      "    kind: copy-in",
      "    layer: design-system",
      "    as: display",
      "    directory: src/components/design-system/display/legacy",
      "    addedAt: 2026-08-03T09:00:00Z",
      "",
    ].join("\n");
    const withSource = copyInEntry("odd").replace("kind: copy-in", "kind: original");

    const problems = verifyManifestIntegrity(
      dirsOf("legacy", "odd"),
      filesOf("odd"),
      manifest(noSource + withSource),
    );

    expect(problems).toContain("legacy: kind が copy-in なのに source がありません。");
    expect(problems).toContain("odd: kind が original なのに source があります。");
  });

  describe("story title と as の検査", () => {
    const source = manifest(copyInEntry("button"));

    const directory = "src/components/design-system/display/button";

    it("見出しが as と食い違えば検出する", () => {
      const problems = verifyManifestIntegrity(
        dirsOf("button"),
        filesOf("button"),
        source,
        new Map(),
        new Map([[directory, "Overlay"]]),
      );

      expect(problems).toContain(
        "button: story の title が Overlay/ で始まっていますが、as は display なので Display/ です。",
      );
    });

    it("title を持たない story を検出する", () => {
      const problems = verifyManifestIntegrity(
        dirsOf("button"),
        filesOf("button"),
        source,
        new Map(),
        new Map([[directory, undefined]]),
      );

      expect(problems).toContain(
        "button: story の title に見出しがありません。Display/ で始めてください。",
      );
    });

    it("見出しが as と一致すれば問題としない", () => {
      const problems = verifyManifestIntegrity(
        dirsOf("button"),
        filesOf("button"),
        source,
        new Map(),
        new Map([[directory, "Display"]]),
      );

      expect(problems).toEqual([]);
    });

    it("story を持たない component は検査しない", () => {
      expect(verifyManifestIntegrity(dirsOf("button"), filesOf("button"), source)).toEqual([]);
    });
  });

  describe("directory と layer / as の突合", () => {
    it("layer と as から導いた場所と食い違えば検出する", () => {
      const source = manifest(
        copyInEntry("button").replace(
          "directory: src/components/design-system/display/button",
          "directory: src/components/patterns/button",
        ),
      );

      const problems = verifyManifestIntegrity(
        ["src/components/patterns/button"],
        new Set(["src/components/design-system/display/button/button.tsx"]),
        source,
      );

      expect(problems).toContain(
        "button: directory が src/components/patterns/button ですが、layer が design-system で as が display なので src/components/design-system/display/button です。",
      );
    });

    it("入れ子の component は親が置き場を決めるため導出と突き合わせない", () => {
      const parent = copyInEntry("table")
        .replace("layer: design-system", "layer: patterns")
        .replace("as: display", "as: sugar")
        .replace(
          "directory: src/components/design-system/display/table",
          "directory: src/components/patterns/table",
        )
        .replace(
          "localPath: src/components/design-system/display/table/table.tsx",
          "localPath: src/components/patterns/table/table.tsx",
        );
      const child = copyInEntry("row-actions")
        .replace("layer: design-system", "layer: patterns")
        .replace("as: display", "as: sugar")
        .replace(
          "directory: src/components/design-system/display/row-actions",
          "directory: src/components/patterns/table/row-actions",
        )
        .replace(
          "localPath: src/components/design-system/display/row-actions/row-actions.tsx",
          "localPath: src/components/patterns/table/row-actions/row-actions.tsx",
        );

      const problems = verifyManifestIntegrity(
        ["src/components/patterns/table", "src/components/patterns/table/row-actions"],
        new Set([
          "src/components/patterns/table/table.tsx",
          "src/components/patterns/table/row-actions/row-actions.tsx",
        ]),
        manifest(parent + child),
      );

      expect(problems).toEqual([]);
    });

    it("目的で割らない層は直下を正とする", () => {
      const source = manifest(
        copyInEntry("saved-views")
          .replace("layer: design-system", "layer: app-starter")
          .replace(
            "directory: src/components/design-system/display/saved-views",
            "directory: src/components/app-starter/saved-views",
          )
          .replace(
            "localPath: src/components/design-system/display/saved-views/saved-views.tsx",
            "localPath: src/components/app-starter/saved-views/saved-views.tsx",
          ),
      );

      const problems = verifyManifestIntegrity(
        ["src/components/app-starter/saved-views"],
        new Set(["src/components/app-starter/saved-views/saved-views.tsx"]),
        source,
      );

      expect(problems).toEqual([]);
    });
  });

  describe("dependencies の検査", () => {
    const source = manifest(copyInEntry("button"));

    it("宣言と実際の参照が食い違えば検出する", () => {
      const problems = verifyManifestIntegrity(
        dirsOf("button"),
        filesOf("button"),
        source,
        new Map([["src/components/design-system/display/button", ["radix-ui"]]]),
      );

      expect(problems).toContain(
        "button: dependencies の宣言 [] が、実際に参照している [radix-ui] と食い違っています。",
      );
    });

    it("実際に何も参照していなければ、宣言が無いことを問題としない", () => {
      const problems = verifyManifestIntegrity(
        dirsOf("button"),
        filesOf("button"),
        source,
        new Map([["src/components/design-system/display/button", []]]),
      );

      expect(problems).toEqual([]);
    });

    it("実参照を渡さなければ dependencies を検査しない", () => {
      expect(verifyManifestIntegrity(dirsOf("button"), filesOf("button"), source)).toEqual([]);
    });
  });

  describe("registryItem の検査", () => {
    function entry(lines: string[]): string {
      const declared = lines.some((line) => line.startsWith("as:"));
      const withHeading = declared ? lines : ["layer: design-system", "as: display", ...lines];
      return `  thing:\n${withHeading.map((line) => `    ${line}`).join("\n")}\n`;
    }

    const sourceLines = [
      "source:",
      "  - repository: shadcn-ui/ui",
      "    path: apps/v4/registry/new-york-v4/ui/checkbox.tsx",
      "    localPath: src/components/design-system/display/thing/thing.tsx",
      `    commit: ${RECORDED}`,
      "    committedAt: 2026-03-02T08:49:00Z",
    ];

    const directories = ["src/components/design-system/display/thing"];

    const files = new Set(["src/components/design-system/display/thing/thing.tsx"]);

    it("上流を持つのに registryItem が無ければ検出する", () => {
      const problems = verifyManifestIntegrity(
        directories,
        files,
        manifest(
          entry([
            "kind: reimplemented",
            "directory: src/components/design-system/display/thing",
            ...sourceLines,
          ]),
        ),
      );

      expect(problems).toContain("thing: kind が reimplemented なのに registryItem がありません。");
    });

    it("original に registryItem があれば検出する", () => {
      const problems = verifyManifestIntegrity(
        directories,
        files,
        manifest(
          entry([
            "kind: original",
            "registryItem: checkbox",
            "directory: src/components/design-system/display/thing",
          ]),
        ),
      );

      expect(problems).toContain("thing: kind が original なのに registryItem があります。");
    });

    it("registryItem と source の path が食い違えば検出する", () => {
      const problems = verifyManifestIntegrity(
        directories,
        files,
        manifest(
          entry([
            "kind: reimplemented",
            "registryItem: switch",
            "directory: src/components/design-system/display/thing",
            ...sourceLines,
          ]),
        ),
      );

      expect(problems).toContain(
        "thing: registryItem switch と source の path apps/v4/registry/new-york-v4/ui/checkbox.tsx が食い違っています。",
      );
    });

    it("registryItem と source の path が揃っていれば問題としない", () => {
      const problems = verifyManifestIntegrity(
        directories,
        files,
        manifest(
          entry([
            "kind: reimplemented",
            "registryItem: checkbox",
            "directory: src/components/design-system/display/thing",
            ...sourceLines,
          ]),
        ),
      );

      expect(problems).toEqual([]);
    });
  });
});

describe("formatIntegrityProblems", () => {
  it("問題が無いことを明示する", () => {
    expect(formatIntegrityProblems([])).toBe("manifest の整合性: 問題ありません。\n");
  });

  it("件数とともに一覧を並べる", () => {
    const text = formatIntegrityProblems(["a: 記録がありません。", "b: 実体がありません。"]);

    expect(text).toContain("manifest の整合性: 2 件");
    expect(text).toContain("  a: 記録がありません。");
    expect(text).toContain("  b: 実体がありません。");
  });
});

describe("collectComponentLayout", () => {
  it("README を持つディレクトリを component として拾う", () => {
    const { directories } = collectComponentLayout([
      "src/components/design-system/display/button/README.md",
      "src/components/design-system/display/button/button.tsx",
      "src/components/feedback/toaster/README.md",
    ]);

    expect(directories).toEqual([
      "src/components/design-system/display/button",
      "src/components/feedback/toaster",
    ]);
  });

  it("入れ子の component を、親と別のディレクトリとして拾う", () => {
    const { directories } = collectComponentLayout([
      "src/components/sugar/table/README.md",
      "src/components/sugar/table/static-data/README.md",
    ]);

    expect(directories).toEqual([
      "src/components/sugar/table",
      "src/components/sugar/table/static-data",
    ]);
  });

  it("カーネル自身の README と scripts を component として扱わない", () => {
    const { directories } = collectComponentLayout([
      "src/components/README.md",
      "src/components/scripts/README.md",
      "src/components/design-system/display/button/README.md",
    ]);

    expect(directories).toEqual(["src/components/design-system/display/button"]);
  });

  it("README を持たないディレクトリは拾わない", () => {
    const { directories } = collectComponentLayout([
      "src/components/design-system/display/button/button.tsx",
    ]);

    expect(directories).toEqual([]);
  });

  it("localPath の照合に使うファイル一覧をそのまま返す", () => {
    const { files } = collectComponentLayout([
      "src/components/design-system/display/button/README.md",
      "src/components/design-system/display/button/button.tsx",
    ]);

    expect(files.has("src/components/design-system/display/button/button.tsx")).toBe(true);
    expect(files.has("src/components/design-system/display/button/missing.tsx")).toBe(false);
  });
});

describe("registryItemOf", () => {
  it("上流ファイルのパスから item 名を取り出す", () => {
    expect(registryItemOf("apps/v4/registry/new-york-v4/ui/checkbox.tsx")).toBe("checkbox");
  });

  it("拡張子を持たないパスもそのまま扱う", () => {
    expect(registryItemOf("checkbox")).toBe("checkbox");
  });
});

describe("vendorImportsOf", () => {
  it("外部 package だけを、重複なく並べ替えて返す", () => {
    expect(
      vendorImportsOf([
        'import { cn } from "@/components/cn";\nimport { Foo } from "./foo";\nimport { X } from "radix-ui";',
        'import { Y } from "radix-ui";\nimport { Z } from "input-otp";',
      ]),
    ).toEqual(["input-otp", "radix-ui"]);
  });

  it("react と react-dom は実行環境として数えない", () => {
    expect(vendorImportsOf(['import { useId } from "react";\nimport x from "react-dom";'])).toEqual(
      [],
    );
  });

  it("入口ではなく package を数える", () => {
    expect(
      vendorImportsOf(['import Image from "next/image";\nimport { Slot } from "radix-ui";']),
    ).toEqual(["next", "radix-ui"]);
  });
});

describe("storyHeadingOf", () => {
  it("title の先頭セグメントを取り出す", () => {
    expect(storyHeadingOf('const meta = { title: "View State/FeedbackState" };')).toBe(
      "View State",
    );
  });

  it("title が無ければ取り出せないことを示す", () => {
    expect(storyHeadingOf("const meta = { component: Button };")).toBeUndefined();
  });
});

describe("componentDirectoryOf", () => {
  // ----- 正常系 -----
  it("design-system では見出しを挟んだ配置先を返す", () => {
    expect(componentDirectoryOf("design-system", "overlay", "dialog")).toBe(
      "src/components/design-system/overlay/dialog",
    );
  });

  it("design-system 以外では見出しを挟まない配置先を返す", () => {
    expect(componentDirectoryOf("patterns", "overlay", "filter-bar")).toBe(
      "src/components/patterns/filter-bar",
    );
  });
});

describe("packageOf", () => {
  // ----- 正常系 -----
  it("scope を持たない specifier から package 名を取り出す", () => {
    expect(packageOf("clsx")).toBe("clsx");
    expect(packageOf("date-fns/locale")).toBe("date-fns");
  });

  it("scope を持つ specifier では scope ごと取り出す", () => {
    expect(packageOf("@tiptap/react")).toBe("@tiptap/react");
    expect(packageOf("@tiptap/react/dist/index")).toBe("@tiptap/react");
  });
});

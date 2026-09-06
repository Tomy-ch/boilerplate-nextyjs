import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const childProcess = vi.hoisted(() => ({
  spawn: vi.fn(),
}));

const fileSystem = vi.hoisted(() => ({
  access: vi.fn(),
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:child_process", () => childProcess);
vi.mock("node:fs/promises", () => fileSystem);

import {
  addShadcnComponents,
  componentManifestEntries,
  splitShadcnAddArguments,
  upsertComponentManifest,
} from "./add-shadcn";

const manifestSource = "schemaVersion: 1\ncomponents: {}\n";
const shadcnPackageSource = '{"version":"4.15.0"}';
const componentsConfigSource = '{"style":"new-york"}';
const registryItemBody = {
  dependencies: ["radix-ui"],
  files: [{ path: "registry/new-york-v4/ui/input-group.tsx" }],
};
const upstreamCommitsBody = [
  { sha: "f31ed81983651234", commit: { committer: { date: "2026-03-02T08:49:00Z" } } },
];

/** パスの断片で応答を切り替える `readFile` を組み立てる。呼び出し順に依存しない。 */
function readFileByPath(componentSource = ""): (path: string) => Promise<string> {
  return (path: string) => {
    if (path.endsWith("components.json")) return Promise.resolve(componentsConfigSource);
    if (path.endsWith("shadcn-manifest.yaml")) return Promise.resolve(manifestSource);
    if (path.endsWith("package.json")) return Promise.resolve(shadcnPackageSource);
    return Promise.resolve(componentSource);
  };
}

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

/** registry item と上流 commit の取得に応答する `fetch` を組み立てる。 */
function fetchUpstream(): (url: string) => Promise<Response> {
  return (url: string) =>
    Promise.resolve(
      jsonResponse(new URL(url).host === "api.github.com" ? upstreamCommitsBody : registryItemBody),
    );
}

function completeChild(exitCode: number | null): EventEmitter {
  const child = new EventEmitter();
  queueMicrotask(() => child.emit("close", exitCode));
  return child;
}

function generatedFiles(...names: string[]): { isFile: () => boolean; name: string }[] {
  return names.map((name) => ({ isFile: () => name.endsWith(".tsx"), name }));
}

/** 指定したパスの断片を含むものだけを「存在する」として扱う `access` を組み立てる。 */
function existingPaths(...fragments: string[]): (path: string) => Promise<void> {
  return (path: string) =>
    fragments.some((fragment) => path.includes(fragment))
      ? Promise.resolve()
      : Promise.reject(new Error("not found"));
}

beforeEach(() => {
  childProcess.spawn.mockReset();
  fileSystem.access.mockReset();
  fileSystem.access.mockRejectedValue(new Error("not found"));
  fileSystem.mkdir.mockReset();
  fileSystem.copyFile.mockReset();
  fileSystem.readdir.mockReset();
  fileSystem.readdir.mockResolvedValue([]);
  fileSystem.readFile.mockReset();
  fileSystem.readFile.mockImplementation(readFileByPath());
  fileSystem.rename.mockReset();
  fileSystem.unlink.mockReset();
  fileSystem.writeFile.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockImplementation(fetchUpstream()));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("splitShadcnAddArguments", () => {
  it("部品名と `--` 以後の CLI オプションを分離する", () => {
    expect(splitShadcnAddArguments(["button", "--", "--yes"])).toEqual({
      components: ["button"],
      as: undefined,
      layer: "design-system",
      shadcnArguments: ["--yes"],
    });
  });

  it("区切りが無いときは、すべての引数を部品名として扱う", () => {
    expect(splitShadcnAddArguments(["button"])).toEqual({
      components: ["button"],
      as: undefined,
      layer: "design-system",
      shadcnArguments: [],
    });
  });

  it("`--as=` を部品名から分け、ラッパー自身のオプションとして取り出す", () => {
    expect(splitShadcnAddArguments(["button", "--as=action", "--", "--yes"])).toEqual({
      components: ["button"],
      as: "action",
      layer: "design-system",
      shadcnArguments: ["--yes"],
    });
  });

  it("`--layer=` を部品名から分け、省略時は design-system になる", () => {
    expect(
      splitShadcnAddArguments(["saved-views", "--as=container", "--layer=app-starter"]),
    ).toEqual({
      components: ["saved-views"],
      as: "container",
      layer: "app-starter",
      shadcnArguments: [],
    });
  });

  it("値の付かない `--layer` は失敗する", () => {
    expect(() => splitShadcnAddArguments(["button", "--layer", "patterns"])).toThrow(
      "層は --layer=<層> の形で指定してください",
    );
  });

  it("値の付かない `--as` は失敗する", () => {
    expect(() => splitShadcnAddArguments(["button", "--as", "action"])).toThrow(
      "見出しは --as=<見出し> の形で指定してください",
    );
  });

  it("部品名を指定しないと失敗する", () => {
    expect(() => splitShadcnAddArguments([])).toThrow(
      "追加する shadcn UI 部品を一つ以上指定してください",
    );
  });

  it("CLI オプションを部品名の位置に指定すると失敗する", () => {
    expect(() => splitShadcnAddArguments(["--yes", "button"])).toThrow(
      "shadcn CLI のオプションは `--` の後ろへ指定してください",
    );
  });
});

describe("upsertComponentManifest", () => {
  it("触っていない部品の source を保ち、同じ部品は最新の追加情報で更新する", () => {
    const result = upsertComponentManifest(
      {
        schemaVersion: 1,
        components: {
          card: {
            kind: "copy-in",
            layer: "design-system",
            as: "display",
            directory: "src/components/design-system/display/card",
            registry: "https://ui.shadcn.com",
            addedAt: "2026-08-01T00:00:00.000Z",
            shadcnCliVersion: "4.14.0",
            source: [
              {
                repository: "shadcn-ui/ui",
                path: "apps/v4/registry/new-york-v4/ui/card.tsx",
                localPath: "src/components/design-system/display/card/card.tsx",
                commit: "f31ed81983651234",
                committedAt: "2026-03-02T08:49:00Z",
              },
            ],
          },
          button: {
            kind: "copy-in",
            layer: "design-system",
            as: "action",
            directory: "src/components/design-system/action/button",
            registry: "https://ui.shadcn.com",
            addedAt: "2026-08-01T00:00:00.000Z",
            shadcnCliVersion: "4.14.0",
          },
        },
      },
      ["button", "dialog"],
      "overlay",
      "design-system",
      "2026-08-02T00:00:00.000Z",
      "4.15.0",
      ["radix-ui"],
    );

    expect(result.components).toEqual({
      card: {
        kind: "copy-in",
        layer: "design-system",
        as: "display",
        directory: "src/components/design-system/display/card",
        registry: "https://ui.shadcn.com",
        addedAt: "2026-08-01T00:00:00.000Z",
        shadcnCliVersion: "4.14.0",
        source: [
          {
            repository: "shadcn-ui/ui",
            path: "apps/v4/registry/new-york-v4/ui/card.tsx",
            localPath: "src/components/design-system/display/card/card.tsx",
            commit: "f31ed81983651234",
            committedAt: "2026-03-02T08:49:00Z",
          },
        ],
      },
      button: {
        kind: "copy-in",
        layer: "design-system",
        as: "overlay",
        registryItem: "button",
        directory: "src/components/design-system/overlay/button",
        registry: "https://ui.shadcn.com",
        addedAt: "2026-08-02T00:00:00.000Z",
        shadcnCliVersion: "4.15.0",
        dependencies: ["radix-ui"],
      },
      dialog: {
        kind: "copy-in",
        layer: "design-system",
        as: "overlay",
        registryItem: "dialog",
        directory: "src/components/design-system/overlay/dialog",
        registry: "https://ui.shadcn.com",
        addedAt: "2026-08-02T00:00:00.000Z",
        shadcnCliVersion: "4.15.0",
        dependencies: ["radix-ui"],
      },
    });
  });
});

describe("addShadcnComponents", () => {
  it("追加成功後に CLI の版と追加時刻を manifest へ記録する", async () => {
    childProcess.spawn.mockImplementation(() => completeChild(0));

    await addShadcnComponents(["button", "--as=action", "--", "--yes"]);

    expect(childProcess.spawn).toHaveBeenCalledWith(
      "pnpm",
      ["exec", "shadcn", "add", "button", "--yes"],
      expect.objectContaining({ stdio: "inherit" }),
    );
    expect(fileSystem.rename).toHaveBeenCalledWith(
      expect.stringContaining("src/components/design-system/button.tsx"),
      expect.stringContaining("src/components/design-system/action/button/button.tsx"),
    );
    expect(fileSystem.copyFile).toHaveBeenCalledWith(
      expect.stringContaining("src/components/component-template.md"),
      expect.stringContaining("src/components/design-system/action/button/README.md"),
    );
    expect(fileSystem.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("shadcn-manifest.yaml"),
      expect.stringContaining("shadcnCliVersion: 4.15.0"),
    );
  });

  it("dry-run では manifest を更新しない", async () => {
    childProcess.spawn.mockImplementation(() => completeChild(0));

    await addShadcnComponents(["button", "--as=action", "--", "--dry-run=true"]);

    expect(fileSystem.readFile).not.toHaveBeenCalled();
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
  });

  it("--view では生成物の移動・manifest 更新を行わない", async () => {
    childProcess.spawn.mockImplementation(() => completeChild(0));

    await addShadcnComponents(["button", "--as=action", "--", "--view"]);

    expect(fileSystem.rename).not.toHaveBeenCalled();
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
  });

  it("shadcn add が失敗すると manifest を更新しない", async () => {
    childProcess.spawn.mockImplementation(() => completeChild(1));

    await expect(addShadcnComponents(["button", "--as=action"])).rejects.toThrow(
      "shadcn add が exit 1",
    );

    expect(fileSystem.readFile).not.toHaveBeenCalled();
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
  });

  it("終了コードが無い失敗も manifest を更新しない", async () => {
    childProcess.spawn.mockImplementation(() => completeChild(null));

    await expect(addShadcnComponents(["button", "--as=action"])).rejects.toThrow("exit null");
  });

  it("複数部品・配置先指定・kebab-case 以外を拒否する", async () => {
    await expect(addShadcnComponents(["button", "dialog"])).rejects.toThrow(
      "一度に追加できる shadcn UI 部品は一つです",
    );
    await expect(addShadcnComponents(["Button"])).rejects.toThrow(
      "部品名は小文字 kebab-case で指定してください",
    );
    await expect(addShadcnComponents([""])).rejects.toThrow(
      "部品名は小文字 kebab-case で指定してください",
    );
    await expect(
      addShadcnComponents(["button", "--as=action", "--", "--path", "elsewhere"]),
    ).rejects.toThrow("--path は指定できません");
    await expect(
      addShadcnComponents(["button", "--as=action", "--", "--path=elsewhere"]),
    ).rejects.toThrow("--path は指定できません");
    await expect(
      addShadcnComponents(["button", "--as=action", "--", "-p", "elsewhere"]),
    ).rejects.toThrow("--path は指定できません");
  });

  it("層に無い値は、shadcn add を走らせる前に失敗する", async () => {
    await expect(addShadcnComponents(["button", "--as=action", "--layer=widgets"])).rejects.toThrow(
      "widgets は component の層にありません",
    );

    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  it("見出しが無い・目録に無い見出しは、shadcn add を走らせる前に失敗する", async () => {
    await expect(addShadcnComponents(["button"])).rejects.toThrow(
      "component 目録の見出しを --as=<見出し> で指定してください",
    );
    await expect(addShadcnComponents(["button", "--as=widget"])).rejects.toThrow(
      "widget は component 目録の見出しにありません",
    );

    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  it("package 済みの依存は生成物を削除し、import を実体へ向け直す", async () => {
    childProcess.spawn.mockImplementation(() => completeChild(0));
    fileSystem.readdir.mockResolvedValue(generatedFiles("button.tsx", "input.tsx", "README.md"));
    fileSystem.access.mockImplementation(
      existingPaths("design-system/action/button/button.tsx", "design-system/form/input/input.tsx"),
    );
    fileSystem.readFile.mockImplementation(
      readFileByPath(
        [
          'import { Button } from "@/components/design-system/button";',
          'import { Input } from "@/components/design-system/input";',
          'import { cn } from "@/components/cn";',
        ].join("\n"),
      ),
    );

    await addShadcnComponents(["input-group", "--as=form", "--", "--yes"]);

    expect(fileSystem.unlink).toHaveBeenCalledWith(
      expect.stringContaining("src/components/design-system/button.tsx"),
    );
    expect(fileSystem.unlink).toHaveBeenCalledWith(
      expect.stringContaining("src/components/design-system/input.tsx"),
    );
    expect(fileSystem.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("src/components/design-system/form/input-group/input-group.tsx"),
      [
        'import { Button } from "../../action/button/button";',
        'import { Input } from "../input/input";',
        'import { cn } from "@/components/cn";',
      ].join("\n"),
    );
  });

  it("依存が無ければ生成物の削除も import の書き換えもしない", async () => {
    childProcess.spawn.mockImplementation(() => completeChild(0));

    await addShadcnComponents(["button", "--as=action", "--", "--yes"]);

    expect(fileSystem.unlink).not.toHaveBeenCalled();
    expect(fileSystem.writeFile).toHaveBeenCalledTimes(1);
  });

  it("未 package の依存は削除せず、取り込み順を知らせる", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    childProcess.spawn.mockImplementation(() => completeChild(0));
    fileSystem.readdir.mockResolvedValue(generatedFiles("command.tsx"));

    await addShadcnComponents(["combobox", "--as=form", "--", "--yes"]);

    expect(fileSystem.unlink).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("未 package の依存"));
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("command"));
    stdout.mockRestore();
  });

  it("import が既に実体を指していれば書き戻さない", async () => {
    childProcess.spawn.mockImplementation(() => completeChild(0));
    fileSystem.readdir.mockResolvedValue(generatedFiles("button.tsx"));
    fileSystem.access.mockImplementation(existingPaths("design-system/action/button/button.tsx"));
    fileSystem.readFile.mockImplementation(
      readFileByPath('import { Button } from "../../action/button/button";'),
    );

    await addShadcnComponents(["input-group", "--as=form", "--", "--yes"]);

    expect(fileSystem.unlink).toHaveBeenCalledOnce();
    expect(fileSystem.writeFile).toHaveBeenCalledTimes(1);
    expect(fileSystem.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("shadcn-manifest.yaml"),
      expect.any(String),
    );
  });

  it("取り込んだ registry item の上流 commit を manifest へ記録する", async () => {
    childProcess.spawn.mockImplementation(() => completeChild(0));
    fileSystem.readFile.mockImplementation(readFileByPath('import { Root } from "radix-ui";'));

    await addShadcnComponents(["input-group", "--as=form", "--", "--yes"]);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://ui.shadcn.com/r/styles/new-york-v4/input-group.json",
      expect.anything(),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "api.github.com/repos/shadcn-ui/ui/commits?path=apps%2Fv4%2Fregistry%2Fnew-york-v4%2Fui%2Finput-group.tsx",
      ),
      expect.anything(),
    );

    const written = fileSystem.writeFile.mock.calls.find((call) =>
      String(call[0]).includes("shadcn-manifest.yaml"),
    );
    expect(String(written?.[1])).toContain("repository: shadcn-ui/ui");
    expect(String(written?.[1])).toContain("path: apps/v4/registry/new-york-v4/ui/input-group.tsx");
    expect(String(written?.[1])).toContain("commit: f31ed81983651234");
    expect(String(written?.[1])).toContain("committedAt: 2026-03-02T08:49:00Z");
    expect(String(written?.[1])).toContain("kind: copy-in");
    expect(String(written?.[1])).toContain("as: form");
    expect(String(written?.[1])).toContain(
      "directory: src/components/design-system/form/input-group",
    );
    expect(String(written?.[1])).toContain(
      "localPath: src/components/design-system/form/input-group/input-group.tsx",
    );
    // 依存は registry の宣言ではなく、置いた実装が実際に import している package から決まる。
    expect(String(written?.[1])).toContain("- radix-ui");
  });

  it("上流 commit を取得できなくても追加は完了し、理由を知らせる", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    childProcess.spawn.mockImplementation(() => completeChild(0));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND ui.shadcn.com")),
    );

    await addShadcnComponents(["input-group", "--as=form", "--", "--yes"]);

    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining("上流 commit を記録できませんでした"),
    );
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("ENOTFOUND"));
    const written = fileSystem.writeFile.mock.calls.find((call) =>
      String(call[0]).includes("shadcn-manifest.yaml"),
    );
    expect(String(written?.[1])).not.toContain("repository:");
    stdout.mockRestore();
  });

  it("registry が HTTP エラーを返した場合も追加は完了する", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    childProcess.spawn.mockImplementation(() => completeChild(0));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await addShadcnComponents(["input-group", "--as=form", "--", "--yes"]);

    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("HTTP 404"));
    stdout.mockRestore();
  });

  it("Error ではない失敗も文字列として知らせる", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    childProcess.spawn.mockImplementation(() => completeChild(0));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network down"));

    await addShadcnComponents(["input-group", "--as=form", "--", "--yes"]);

    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("network down"));
    stdout.mockRestore();
  });

  it("既存部品は --overwrite なしでは上書きしない", async () => {
    fileSystem.access.mockResolvedValue(undefined);

    await expect(addShadcnComponents(["button", "--as=action"])).rejects.toThrow(
      "button は既に存在します",
    );

    childProcess.spawn.mockImplementation(() => completeChild(0));
    await addShadcnComponents(["button", "--as=action", "--", "--overwrite=true"]);
  });
});

describe("componentManifestEntries", () => {
  // ----- 正常系 -----
  it("部品ごとに層・見出し・配置先を備えた台帳項目を作る", () => {
    const entries = componentManifestEntries(
      ["dialog"],
      "overlay",
      "design-system",
      "2026-08-08T00:00:00.000Z",
      "4.15.0",
      [],
    );

    expect(entries["dialog"]).toMatchObject({
      kind: "copy-in",
      layer: "design-system",
      as: "overlay",
      registryItem: "dialog",
      directory: "src/components/design-system/overlay/dialog",
      addedAt: "2026-08-08T00:00:00.000Z",
      shadcnCliVersion: "4.15.0",
    });
  });

  it("依存を渡すと台帳項目へ写す", () => {
    const entries = componentManifestEntries(
      ["dialog"],
      "overlay",
      "design-system",
      "2026-08-08T00:00:00.000Z",
      "4.15.0",
      ["radix-ui"],
    );

    expect(entries["dialog"]).toMatchObject({ dependencies: ["radix-ui"] });
  });

  it("依存が無ければ dependencies を持たせない", () => {
    const entries = componentManifestEntries(
      ["dialog"],
      "overlay",
      "design-system",
      "2026-08-08T00:00:00.000Z",
      "4.15.0",
      [],
    );

    expect(entries["dialog"]).not.toHaveProperty("dependencies");
  });

  it("部品を渡さなければ空の台帳項目を返す", () => {
    expect(
      componentManifestEntries(
        [],
        "overlay",
        "design-system",
        "2026-08-08T00:00:00.000Z",
        "4.15.0",
        [],
      ),
    ).toEqual({});
  });
});

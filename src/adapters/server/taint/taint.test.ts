import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { Writable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { EXPERIMENTAL_REACT_MODULES } from "./experimental-react.fixture";

/**
 * `react` を Next.js 同梱の experimental build（react-server）へ向ける。
 *
 * 本番で `experimental.taint` を立てた Next.js が RSC の描画に使うのはこのビルドで、
 * stable の `react` は taint の口を持たない。**防御の側に「口があれば呼ぶ」分岐を置かないため、
 * テストの側で解決先を決める**。
 */
vi.mock("react", async () => {
  const { createRequire: create } = await import("node:module");
  const { EXPERIMENTAL_REACT_MODULES: modules } = await import("./experimental-react.fixture");
  const mockRequire = create(import.meta.url);

  return mockRequire(mockRequire.resolve(modules.react));
});

import { taintObjectReference, taintUniqueValue } from "./taint";

const localRequire = createRequire(import.meta.url);

/** 綴りを、pnpm の配置を解いた実体の位置へ直す。CJS の名前解決へ渡すため symlink も解く。 */
function locate(specifier: string): string {
  return realpathSync(
    path.join(path.dirname(localRequire.resolve("next/package.json")), "..", specifier),
  );
}

const paths = {
  react: locate(EXPERIMENTAL_REACT_MODULES.react),
  reactDom: locate(EXPERIMENTAL_REACT_MODULES.reactDom),
  serverDom: locate(EXPERIMENTAL_REACT_MODULES.serverDom),
};

/**
 * RSC 直列化器とその React が CJS で名指す綴り。
 *
 * @remarks
 * 直列化器は `require("react")` / `require("react-dom")` で引き、同梱ビルドどうしも
 * `next/dist/compiled/*` で名指し合う。すべて同じ実体へ向けないと、taint の登録簿を持つ React と
 * 直列化器が見る React が別になり、汚したはずの値が素通りする。
 */
const RESOLUTIONS: ReadonlyMap<string, string> = new Map([
  ["react", paths.react],
  ["next/dist/compiled/react-experimental", paths.react],
  ["react-dom", paths.reactDom],
  ["next/dist/compiled/react-dom-experimental", paths.reactDom],
]);

/** Node の CJS 名前解決。差し替えて元へ戻すため、綴りを 1 か所に持つ。 */
const RESOLVE_FILENAME = "_resolveFilename";

const CLIENT_MODULE_ID = "file:///user-card.tsx";
const CLIENT_EXPORT_NAME = "UserCard";

/** 直列化の相手にする Client Component の実体。呼ばれないので中身を持たない。 */
const clientComponent = () => null;

let serverDom: unknown;
let react: unknown;
let originalResolve: unknown;

/** `owner` の関数を名前で引いて呼ぶ。生成物は型を持たないので、呼ぶ直前に形だけ確かめる。 */
function callFunction(owner: unknown, name: string, args: readonly unknown[]): unknown {
  const candidate = typeof owner === "object" && owner !== null ? Reflect.get(owner, name) : owner;

  if (typeof candidate !== "function") {
    throw new Error(`${name} を呼べません`);
  }

  return Reflect.apply(candidate, owner, args);
}

beforeAll(async () => {
  const nodeModule = await import("node:module");

  originalResolve = Reflect.get(nodeModule.default, RESOLVE_FILENAME);

  if (typeof originalResolve !== "function") {
    throw new Error("Node の CJS 名前解決を差し替えられません");
  }

  Reflect.set(
    nodeModule.default,
    RESOLVE_FILENAME,
    function patched(this: unknown, ...args: unknown[]): unknown {
      const [request] = args;
      const mapped = typeof request === "string" ? RESOLUTIONS.get(request) : undefined;

      if (mapped !== undefined) {
        return mapped;
      }

      if (typeof originalResolve !== "function") {
        throw new Error("Node の CJS 名前解決を失いました");
      }

      return Reflect.apply(originalResolve, this, args);
    },
  );

  serverDom = localRequire(paths.serverDom);
  react = localRequire(paths.react);
});

afterAll(async () => {
  const nodeModule = await import("node:module");

  Reflect.set(nodeModule.default, RESOLVE_FILENAME, originalResolve);
});

/** Client Component に `props` を渡して直列化し、直列化器が報告した失敗を集める。 */
async function renderToClient(props: Record<string, unknown>): Promise<string[]> {
  const errors: string[] = [];
  const client = callFunction(serverDom, "registerClientReference", [
    clientComponent,
    CLIENT_MODULE_ID,
    CLIENT_EXPORT_NAME,
  ]);
  const manifest = {
    [`${CLIENT_MODULE_ID}#${CLIENT_EXPORT_NAME}`]: {
      id: CLIENT_MODULE_ID,
      chunks: [],
      name: CLIENT_EXPORT_NAME,
    },
  };

  await new Promise<void>((resolve) => {
    const sink = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    sink.on("finish", resolve);

    const element = callFunction(react, "createElement", [client, props]);
    const stream = callFunction(serverDom, "renderToPipeableStream", [
      element,
      manifest,
      {
        onError(error: unknown) {
          errors.push(String(error));
        },
      },
    ]);

    callFunction(stream, "pipe", [sink]);
  });

  return errors;
}

describe("taintObjectReference", () => {
  // ----- 正常系 -----
  it("汚していない object は client へ渡せる", async () => {
    expect(await renderToClient({ session: { userId: "u1" } })).toEqual([]);
  });

  it("汚した object を client へ渡すと、直列化が理由を添えて落ちる", async () => {
    const record = { session: { userId: "u1" }, accessToken: "secret-token" };

    taintObjectReference("session record を client へ渡さない", record);

    expect(await renderToClient({ session: record })).toContain(
      "Error: session record を client へ渡さない",
    );
  });

  it("コピーには及ばない", async () => {
    const record = { session: { userId: "u1" }, accessToken: "secret-token" };

    taintObjectReference("session record を client へ渡さない", record);

    expect(await renderToClient({ session: { ...record } })).toEqual([]);
  });
});

describe("taintUniqueValue", () => {
  // ----- 正常系 -----
  it("汚した値を client へ渡すと、直列化が理由を添えて落ちる", async () => {
    const lifetime = {};

    taintUniqueValue("署名鍵を client へ渡さない", lifetime, "top-secret-key");

    expect(await renderToClient({ secret: "top-secret-key" })).toContain(
      "Error: 署名鍵を client へ渡さない",
    );
  });

  it("派生値には及ばない", async () => {
    const lifetime = {};

    taintUniqueValue("署名鍵を client へ渡さない", lifetime, "derived-secret-key");

    expect(await renderToClient({ secret: "Bearer derived-secret-key" })).toEqual([]);
  });
});

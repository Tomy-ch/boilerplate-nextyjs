import { spawn } from "node:child_process";

import { mockServer } from "../../mocks/node";
import { startMockApi } from "../../mocks/serve";
import { loadEnvironment } from "../../src/config/load-environment";
import { portOf, servesMockApi } from "./build";

/**
 * 取得先を用意してから `next build` を回す。
 *
 * 使い方: `pnpm build`
 *
 * **`use cache` を持つ取得は組み立て時に評価される**ので、build には取得先が要る。
 * `APP_API_MODE=mock` のときは、`src/instrumentation.ts` の interception がプリレンダーの
 * worker プロセスへ届かないため、ここで HTTP の口として立てる
 * （[mocks/serve.ts](../../mocks/serve.ts)）。
 */

loadEnvironment();

const baseUrl = process.env["APP_API_BASE_URL"];
let server: ReturnType<typeof startMockApi> | undefined;

if (servesMockApi(process.env["APP_API_MODE"]) && baseUrl !== undefined) {
  // 素通しにすると、掴まれなかった要求がこの口自身へ向き直って輪になる。
  mockServer.listen({ onUnhandledRequest: "error" });
  server = startMockApi(portOf(baseUrl));
}

const build = spawn("next", ["build"], { stdio: "inherit" });

build.on("exit", (code, signal) => {
  server?.close();
  process.exit(code ?? (signal === null ? 1 : 0));
});

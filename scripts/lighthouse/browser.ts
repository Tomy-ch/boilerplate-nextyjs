import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** ブラウザへ置く cookie 1 つぶん。 */
export type BrowserCookie = {
  /** 効かせる宛先。ポートは含めない。 */
  readonly domain: string;
  readonly name: string;
  /** 効かせる経路。 */
  readonly path: string;
  readonly value: string;
};

/** 立ち上げたブラウザ。 */
export type Browser = {
  /** 落として profile を片付ける。 */
  readonly close: () => void;
  /** CDP を受け付けているポート。Lighthouse へ `--port` で渡す。 */
  readonly port: number;
  /** browser の口。cookie を置くのはここ。 */
  readonly wsUrl: string;
};

/** 立ち上がるのを待つ上限。CI の遅い機械でも足りる長さ。 */
const READY_TIMEOUT_MS = 20_000;

/** 待つあいだの間隔。 */
const POLL_INTERVAL_MS = 50;

/** ブラウザが待ち受け先を書き出す名前。1 行目がポート、2 行目が browser の口の経路。 */
const PORT_FILE = "DevToolsActivePort";

/** `Storage.setCookies` へ振る番号。1 往復しかしないので固定でよい。 */
const SET_COOKIES_ID = 1;

/** 待ち受け先として認める綴り。1 行目は 10 進のポート、2 行目は browser の口の経路。 */
const PORT_SHAPE = /^\d{1,5}$/;
const WS_PATH_SHAPE = /^\/devtools\/browser\/[0-9a-fA-F-]+$/;

/**
 * ブラウザが待ち受け先を書き出すまで待つ。
 *
 * @remarks
 * **ポートはこちらで選ばず、ブラウザに選ばせます。** 空きを探して渡す形にすると、探してから
 * 渡すまでの間に別のプロセスがそこを取る余地が残ります。書き出された値を読めば、実際に
 * 待ち受けている先そのものが手に入ります。
 *
 * 2 行目が揃うまで待ちます。書き出しは 1 度に終わるとは限らず、ポートだけ読めた時点で進むと
 * 口の経路が空のまま組み立てることになります。
 */
async function waitForPortFile(
  profile: string,
  child: ChildProcess,
  timeoutMs: number,
): Promise<{ port: number; wsPath: string }> {
  const deadline = Date.now() + timeoutMs;
  const path = join(profile, PORT_FILE);

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`ブラウザが起動前に終了しました（終了コード ${String(child.exitCode)}）`);
    }

    const [port, wsPath] = existsSync(path)
      ? readFileSync(path, "utf8").split("\n")
      : [undefined, undefined];

    if (port !== undefined && wsPath !== undefined && wsPath !== "") {
      // **綴りを確かめてから繋ぎ先にする。** 中身を書くのはこちらが起動したプロセスだが、
      // 読んだ値をそのまま繋ぎ先に使うと、書き換えられた置き場が別の宛先を指せる。
      if (!PORT_SHAPE.test(port) || !WS_PATH_SHAPE.test(wsPath)) {
        throw new Error(`待ち受け先の綴りが読めません: ${port} ${wsPath}`);
      }

      return { port: Number(port), wsPath };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`ブラウザが ${String(timeoutMs)}ms で待ち受けを始めませんでした`);
}

/**
 * 計測に使うブラウザを立ち上げる。
 *
 * @remarks
 * **Lighthouse に起動させず、こちらで起動します。** CLI へ渡せるのは要求ヘッダの追加までで、
 * ブラウザの cookie 置き場へは触れないためです（{@link putCookies}）。同意を選び終えた状態から
 * 測るには本物の cookie が要ります。
 *
 * profile は実行ごとの使い捨てにします。使い回すと、前の実行が残したキャッシュや cookie が
 * 次の数値へ効き、同じ木を測っても回ごとに違う答えが出ます。
 *
 * @param executablePath - 起動する実体。版は lockfile の `@playwright/test` が決める。
 * @param flags - 起動時の指定（`buildChromeFlags`）。
 * @param timeoutMs - 立ち上がるのを待つ上限。
 */
export async function startBrowser(
  executablePath: string,
  flags: readonly string[],
  timeoutMs: number = READY_TIMEOUT_MS,
): Promise<Browser> {
  const profile = mkdtempSync(join(tmpdir(), "lighthouse-profile-"));
  const child = spawn(
    executablePath,
    [
      ...flags,
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  // 後片付けは、落ちても計測を落とさない。終了しきる前に消しに行くと書き込み中のファイルが
  // 残って `ENOTEMPTY` になるが、それは残骸であって計測の失敗ではない。
  const close = () => {
    child.kill();

    try {
      rmSync(profile, { force: true, maxRetries: 20, recursive: true, retryDelay: 100 });
    } catch {
      // 使い捨ての置き場なので、消せなくても次の実行に影響しない。
    }
  };

  try {
    const { port, wsPath } = await waitForPortFile(profile, child, timeoutMs);

    return { close, port, wsUrl: `ws://127.0.0.1:${String(port)}${wsPath}` };
  } catch (cause) {
    close();

    throw cause;
  }
}

/**
 * ブラウザの cookie 置き場へ直に置く。
 *
 * @remarks
 * `Storage.setCookies` は browser の口が答えるので、頁を開く前に置けます。開いてから置くと、
 * 最初の描画は cookie が無い状態で行われ、置いた意味が無くなります。
 *
 * @param wsUrl - `startBrowser` が返した browser の口。
 * @param cookies - 置く cookie。1 つも無ければ繋ぎません。
 */
export async function putCookies(wsUrl: string, cookies: readonly BrowserCookie[]): Promise<void> {
  if (cookies.length === 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({ id: SET_COOKIES_ID, method: "Storage.setCookies", params: { cookies } }),
      );
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        error?: { message: string };
        id?: number;
      };

      // 口は他の遣り取りにも使われるので、こちらの番号の答えだけを見る。
      if (message.id !== SET_COOKIES_ID) {
        return;
      }

      socket.close();

      if (message.error === undefined) {
        resolve();
      } else {
        reject(new Error(`cookie を置けませんでした: ${message.error.message}`));
      }
    });

    socket.addEventListener("error", () => reject(new Error("CDP の口へ繋げませんでした")));
  });
}

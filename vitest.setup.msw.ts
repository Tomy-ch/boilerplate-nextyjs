import { HttpResponse, http, type JsonBodyType, passthrough } from "msw";
import { afterAll, afterEach, type MockInstance, vi } from "vitest";

import { mockServer } from "./mocks/node";

// HTTP を止める。**要るファイルだけが読み込む。**
//
// 契約駆動ハンドラを dev サーバーと共有する理由と、ハンドラの無い宛先を落とす理由は
// `mocks/README.md` が持つ。`fetch` を直接差し替えているテストは MSW に届く前に自分で応答を
// 作るため、落とす判定には掛からない。
//
// **これを `setupFiles` へ戻さないこと。**全ファイルへ掛けたときの費用と、読み込む相手を
// HTTP 境界に限る理由は `docs/testing-conventions.md`「mock の境界」が持つ。読み込まないファイルは、
// 宛先を名指しで落とす番人が `vitest.setup.ts` 側に立つ。
//
// 立てるのが hook ではなく module の評価時なのは、番人より先に席を取るためである。番人は
// 「誰も `fetch` を差し替えていないファイル」にだけ立つので、後から立てると両方が並ぶ。
mockServer.listen({ onUnhandledRequest: "error" });

afterEach(() => {
  mockServer.resetHandlers();
});

afterAll(() => {
  mockServer.close();
});

/**
 * 契約のパス 1 本に応答を割り当て、そこへ届いた要求を記録する。
 *
 * @remarks
 * 差し替えるのは「この 1 本がこの応答を返す」ことだけで、止める位置はファイル冒頭のとおり
 * HTTP 境界に揃ったままです。
 *
 * 引数ではなく届いた要求を返すのは、`fetch` へ渡した引数を見ると URL を組み立てる責務の在り処に
 * 関わらず「呼び方」を固定してしまうためです。
 *
 * 追加したハンドラは `resetHandlers()` が毎テスト後に取り除きます。
 *
 * @param url - 割り当てる絶対 URL。クエリ文字列は照合に使われない
 * @param body - JSON として返す応答本文
 * @returns 届いた要求。呼び出しの順に積まれる
 */
export function serveJson(url: string, body: JsonBodyType): readonly Request[] {
  const requests: Request[] = [];

  mockServer.use(
    http.get(url, ({ request }) => {
      requests.push(request);

      return HttpResponse.json(body);
    }),
  );

  return requests;
}

/** 書き込みに使う HTTP メソッド。 */
export type WriteMethod = "post" | "patch" | "put" | "delete";

/**
 * 書き込み 1 本に応答を割り当て、届いた要求を記録する。
 *
 * @remarks
 * {@link serveJson} の書き込み版です。分けてあるのは、記録する要求の**複製**を積むためです。
 * 本文を持つ要求は読み出しが 1 度きりで、記録した側と検証する側が同じ実体を見ると、先に読んだ
 * 方だけが中身を得ます。
 *
 * @param method - 割り当てるメソッド
 * @param url - 割り当てる絶対 URL。動的な区間は `:name` で表す
 * @param body - JSON として返す応答本文
 * @returns 届いた要求の複製。呼び出しの順に積まれる
 */
export function serveWrite(
  method: WriteMethod,
  url: string,
  body: JsonBodyType,
): readonly Request[] {
  const requests: Request[] = [];

  mockServer.use(
    http[method](url, ({ request }) => {
      requests.push(request.clone());

      return HttpResponse.json(body);
    }),
  );

  return requests;
}

/** 応答を割り当てられる HTTP メソッド。 */
export type ServedMethod = "get" | WriteMethod;

/**
 * 宛先 1 本に、本文を持たない応答の status を割り当てる。
 *
 * @remarks
 * 内側は分類済みのエラーしか見ないため、正規化の入口を確かめるには生の status をここで
 * 与えるしかありません。
 *
 * 本文を持たない応答は失敗だけではありません。`204` を返す削除も同じ形なので、届いた要求を
 * {@link serveWrite} と同じく記録して返します。
 *
 * @param method - 割り当てるメソッド
 * @param url - 割り当てる絶対 URL。動的な区間は `:name` で表す
 * @param status - 返す HTTP status
 * @returns 届いた要求の複製。呼び出しの順に積まれる
 */
export function serveStatus(method: ServedMethod, url: string, status: number): readonly Request[] {
  const requests: Request[] = [];

  mockServer.use(
    http[method](url, ({ request }) => {
      requests.push(request.clone());

      return new HttpResponse(null, { status });
    }),
  );

  return requests;
}

/**
 * 指定した origin 宛の要求を素通しさせる。
 *
 * @remarks
 * ハンドラの無い宛先を落とす既定（`onUnhandledRequest: "error"`）に対する、唯一の逃げ道です。
 * テスト自身が立てた本物のサーバへ出す要求は、差し替えるべき外部ではなく検証対象そのものなので、
 * 宛先を名指しして開けます。
 *
 * 既定の側を緩めて済ませないこと。緩めると宛先を打ち間違えた取得まで通り、手元では本物の網へ
 * 届き CI では時間切れになるという形でしか現れなくなります。
 *
 * @param origin - 素通しさせる scheme + host + port
 */
export function passThroughOrigin(origin: string): void {
  mockServer.use(http.all(`${origin}/*`, () => passthrough()));
}

/**
 * `fetch` の呼び出しを記録する。**応答は差し替えない。**
 *
 * @remarks
 * Next.js のキャッシュ指定（`cache` / `next.tags`）は要求として送出されないため、HTTP 境界からは
 * 観測できません。指定されたことを確かめる手段は呼び出しの引数しかなく、そこだけを覗きます。
 * 応答は MSW のハンドラが返したものがそのまま通ります。
 *
 * 記録を止めるのは `vi.restoreAllMocks()` です。呼ぶテストファイルが `afterEach` で片付けます。
 */
export function watchFetch(): MockInstance<typeof fetch> {
  return vi.spyOn(globalThis, "fetch");
}

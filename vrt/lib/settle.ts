import type { Page } from "@playwright/test";

/**
 * story が描き切るのを待つ上限。
 *
 * @remarks
 * test 全体の上限（`playwright.config.ts` の `timeout`）より十分に短く取ります。同じ値に任せると、
 * 描き切らない story 1 件が上限をまるごと使い、`retries` の回数だけそれを繰り返します。story 数が
 * 多いので、数件の道連れで実行時間が倍近くまで伸び、ログには「時間切れ」しか残りません。
 */
const RENDER_TIMEOUT_MS = 15_000;

/**
 * まだ story を組み立てている最中を表す Storybook の段階。
 *
 * @remarks
 * `playing` を含めるのが要点です。`play` を持つ story は、描画が終わってから操作が走って初めて
 * 見せたい状態になります。ここを待たずに撮ると、操作前の絵で「安定した」と判定されます。
 */
const PENDING_PHASES = ["preparing", "loading", "beforeEach", "rendering", "playing"];

/**
 * DOM の変化が止まったと見なすまでの静止時間。
 *
 * @remarks
 * Storybook が「描画が終わった」と言うのは**最初の commit まで**で、そこから遅れて届くものが
 * ある。`next/dynamic` の別チャンクが実測 23ms 後に中身を差し込む例があり、待たずに撮ると
 * 枠だけの絵になる。1 フレームでは足りず、長く取ると story 数の分だけ実行時間へ効くので、
 * 遅れて届くものを跨げる最小の幅を置く。
 */
const QUIET_MS = 150;

/**
 * 描画・操作・フォントの読み込みが終わるのを待つ。
 *
 * @remarks
 * 描画の完了は配色テーマが `:root` へ乗ったことで見ます。テーマを載せるのが story を包む
 * decorator（`.storybook/preview.tsx`）なので、乗っていれば story まで到達しています。要素の
 * 出現で見ると、描画前の空の `#storybook-root` を「安定した画面」として扱ってしまいます。
 *
 * **`play` の完了まで待ちます。** Playwright は連続する 2 枚が一致した時点で「安定した」と見なし、
 * そこで比較して落とします。操作がまだ走っていない状態も 2 枚一致するので、待たずに撮ると
 * 操作前の絵が確定した絵として扱われます。撮り直しでも同じことが起き、そちらは**操作前の絵が
 * 基準画像として焼かれる**ぶん質が悪い（story は以後なにも検証しなくなり、入力ハッシュが
 * 一致する限り比較も省かれるので気づけない）。
 *
 * フォントは差し替わった瞬間に字形が変わるため、待たずに撮ると同じ story が撮るたびに違う
 * 画像になります。
 *
 * **ページのスクロールを先頭へ戻します。** 撮るのはビューポートのぶんだけなので、
 * スクロール位置が違えば同じ状態でも別の絵になります。`play` を持つ story は操作の途中で
 * focus が動き、ブラウザはその要素を見せるためにページを送ります。送る量は操作した時点の
 * 文書の高さで決まるので、story の宣言のどこにも現れません。
 *
 * **最後に DOM が静止し、画像が出そろうのを待ちます。** Storybook の言う描画完了は最初の
 * commit までで、`next/dynamic` の別チャンクや遅れて走る effect はそのあとに届きます。画像は
 * DOM を変えないまま絵を変えるので、静止の判定とは別に見ます。
 */
export async function settle(page: Page, theme: string): Promise<void> {
  try {
    await page.waitForFunction(
      (expected) => document.documentElement.dataset["theme"] === expected,
      theme,
      { timeout: RENDER_TIMEOUT_MS },
    );
  } catch (cause) {
    throw new Error(
      `story が描き切りませんでした（${RENDER_TIMEOUT_MS / 1000} 秒）。テーマを載せる decorator が` +
        "一度も走っていません。story の module が読み込みに失敗していないか、Storybook で" +
        "同じ story を開いて確かめてください。",
      { cause },
    );
  }

  try {
    await page.waitForFunction(
      (pending) => {
        const renders = (
          globalThis as unknown as {
            __STORYBOOK_PREVIEW__?: { storyRenders?: { phase?: string }[] };
          }
        ).__STORYBOOK_PREVIEW__?.storyRenders;
        if (renders === undefined || renders.length === 0) return false;

        return renders.every(
          (render) => render.phase !== undefined && !pending.includes(render.phase),
        );
      },
      PENDING_PHASES,
      { timeout: RENDER_TIMEOUT_MS },
    );
  } catch (cause) {
    throw new Error(
      `story の操作が終わりませんでした（${RENDER_TIMEOUT_MS / 1000} 秒）。play が返らないか、` +
        "その中の待ち合わせが解決していません。Storybook で同じ story を開き、Interactions が" +
        "最後まで進むか確かめてください。",
      { cause },
    );
  }

  await page.evaluate(() => document.fonts.ready);

  // 戻すのはページのスクロールだけ。送り終えた位置そのものが見せたい状態である story
  // （carousel / message-scroller など）は、内側の領域を送っているので動かない。
  //
  // behavior を明示するのは、`scroll-behavior: smooth` の下では既定が滑らかな送りになり、
  // 撮影が動いている最中に掛かるため。
  await page.evaluate(() => window.scrollTo({ behavior: "instant", left: 0, top: 0 }));

  // 変化の時刻を記録する側と、静止を判定する側を分ける。判定のたびに購読を張り直すと、
  // そのたびに「いま張った」時点からの静止しか見えない。
  await page.evaluate(() => {
    const marker = globalThis as unknown as { __vrtLastMutation?: number };
    marker.__vrtLastMutation = performance.now();
    new MutationObserver(() => {
      marker.__vrtLastMutation = performance.now();
    }).observe(document.documentElement, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  });

  try {
    await page.waitForFunction(
      (quiet) => {
        const marker = globalThis as unknown as { __vrtLastMutation?: number };
        const last = marker.__vrtLastMutation;
        if (last === undefined || performance.now() - last < quiet) return false;

        // 見るのはビューポートに掛かっている画像だけ。**外にある画像を待ってはいけない。**
        // `loading="lazy"` は画面へ近づくまで取得を始めないので、外にあるものの `complete` は
        // 永久に false のままで、待てば必ず時間切れになる。撮るのはビューポートのぶんなので、
        // 外にある画像は絵にも現れない。
        //
        // `complete` は読み終わりと失敗の両方で立つ。撮るのは届いた結果であって成否ではない。
        return [...document.images]
          .filter((image) => {
            const rect = image.getBoundingClientRect();

            return (
              rect.bottom > 0 &&
              rect.top < window.innerHeight &&
              rect.right > 0 &&
              rect.left < window.innerWidth
            );
          })
          .every((image) => image.complete);
      },
      QUIET_MS,
      { timeout: RENDER_TIMEOUT_MS },
    );
  } catch (cause) {
    throw new Error(
      `story が静止しませんでした（${RENDER_TIMEOUT_MS / 1000} 秒）。DOM を書き換え続けている` +
        "か、読み終わらない画像があります。Storybook で同じ story を開き、要素の追加が止まるか、" +
        "読めない画像が無いか確かめてください。",
      { cause },
    );
  }
}

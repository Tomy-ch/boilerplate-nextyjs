// IdP を通さずに session を得るための口。面（`/dev/session`）と、直接発行する API の 2 つある。
//
// アプリ側の宣言（`src/features/dev-session/paths.ts` /
// `src/app/api/auth/test-session/route.dev.ts`）を写す。読み込まないのは、feature と Route Handler
// の内部へ触れてよいのが app 層だけであるため。
// 検査の側がその境界を越えても eslint の境界検査は `src/**` しか見ないので、越えたことに誰も
// 気づかない。
//
// **写した先を 1 つに保つ。** 叩く側が 2 つあり（ブラウザの中から叩く `test.ts` と、ホストの
// プロセスから叩く `scripts/lighthouse/`）、別々に写すと path を変えたときに片方だけが古い綴りを
// 送り続ける。そのとき起きるのは「ログインへ送られた画面を計測して緑になる」ことで、赤くならない。
//
// 面の経路のずれは E2E が捕まえる。宣言した route は build の出力と突き合わせるので
// （`screens.ts`）、アプリ側が動いてこちらが取り残されれば「画面の宣言がありません」で落ちる。

/** IdP を通さずに session を発行する画面。開発と CI でだけ開く。 */
export const DEV_SESSION_PATH = "/dev/session";

/** 発行したあとの戻り先を持ち回るための検索条件の名前。 */
export const DEV_SESSION_RETURN_PARAM = "returnUrl";

/** テスト専用に session を直接発行する口。同じく開発と CI でだけ開く。 */
export const TEST_SESSION_PATH = "/api/auth/test-session";

/** 発行できたときに返る状態。これ以外は口が開いていない。 */
export const TEST_SESSION_ISSUED_STATUS = 204;

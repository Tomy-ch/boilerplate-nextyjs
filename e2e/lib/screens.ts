// 巡回・撮影の対象になる画面の列挙。
//
// 対象は build の出力から取る。画面の一覧を手で持つと、新しく足した画面が黙って対象外のまま
// 残る。story の撮影対象を目録から取るのと同じ規律（[vrt/README.md](../../vrt/README.md)）。
//
// 一方で、URL は build の出力からは決まらない。動的区間へ何を入れるか、どの画面が URL では
// 開けないかは宣言でしか表せないため、**route ごとの宣言を必須にする**。宣言の無い route が
// 現れたら落ちるので、足した画面は必ずここへ現れる。
import type { SessionRole } from "@/model/session";

import { DEV_SESSION_PATH } from "./dev-session.js";

/**
 * build が書き出す、app の path と route の対応表。
 *
 * @remarks
 * 読み込みは呼び出し側に置いてあります。build の生成物なので、build していない木では存在せず、
 * module を読み込んだだけで落ちる形にすると Vitest からこの module を検査できません。
 */
export const SCREEN_MANIFEST_FILE = ".next/app-path-routes-manifest.json";

/** 画面を表す app path の末尾。Route Handler（`/route`）と区別する。 */
const PAGE_SUFFIX = "/page";

/**
 * 画面の名前が採れる形。
 *
 * @remarks
 * kebab-case に限るのは命名規約に従うためですが、効いている先はそれだけではありません。
 * **この名前は 2 つの経路でそのまま外へ出ます** —— 基準画像のファイル名
 * （[`screen-baselines.ts`](screen-baselines.ts)）と、CI が PR へ書く表のセル
 * （`scripts/lighthouse/report.ts`）です。前者では区切りや `..` がパスを外れさせ、後者では
 * バッククォートや角括弧が Markdown を作ります。**ここで狭めておけば、その先のどこでも濾し直さずに
 * 済みます**（「許可した集合は markup も mention も作れない」を、出口ではなく入口で満たす形）。
 */
const SCREEN_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 巡回・撮影する画面 1 つ。 */
export type Screen = {
  /** build が出す route。宣言との突き合わせに使う。 */
  readonly route: string;
  /** 基準画像を分ける区画の名前。 */
  readonly name: string;
  /** 実際に開く URL のパス。 */
  readonly path: string;
  /**
   * 開く前に作る session の役割。
   *
   * @remarks
   * 保護された経路は、session を持たずに開くとログインへ送られます。撮れるのはログイン画面で
   * あって目的の画面ではないため、**保護された画面は撮れないのではなく、開き方が違うだけ**です。
   *
   * 役割まで宣言するのは、認証だけでは足りない経路があるためです。役割が足りないまま開くと
   * 送り返され、やはり目的の画面は撮れません（`src/model/authz.ts`）。
   */
  readonly signedIn?: SessionRole;
  /**
   * 撮影から外す領域の CSS 選択子。
   *
   * @remarks
   * **モックで固定できない値を描く場所にだけ与えます。**応答はモックが同じ要求へ同じものを
   * 返しますが（`mocks/stable-responses.ts`）、画面が要求時刻から導く値はそこに載りません。
   * 外さないと、基準を撮った日を過ぎた時点でその画面が毎回落ちます。
   *
   * 外すのは値を描く最小の範囲に留めます。広く覆うほど、崩れても気づけない面が増えます。
   */
  readonly mask?: readonly string[];
  /**
   * 撮る前に現れているべき要素の CSS 選択子。
   *
   * @remarks
   * **最初の一式から外した島（`next/dynamic`）を持つ画面にだけ与えます。** その島は枠だけを置いて
   * 後から描かれるので、届く前に撮ると枠のまま写ります。枠は連続して撮っても同じなので、
   * **Playwright の「同じ絵が 2 回続いたら撮る」判定を素通りします** —— 撮る側が待つ相手を
   * 知っていなければ、届いた日と届かなかった日の絵が交互に基準へ入ります。
   *
   * 指すのは島が描き終えた印です。枠（`loading`）ではなく、中身にしか現れない要素を選びます。
   */
  readonly settled?: string;
};

/** route 1 つに対する宣言。開くか、開かない理由を持つ。 */
export type ScreenDeclaration =
  | {
      readonly route: string;
      readonly name: string;
      readonly path: string;
      readonly signedIn?: SessionRole;
      /** 撮影から外す領域の CSS 選択子（{@link Screen.mask}）。 */
      readonly mask?: readonly string[];
      /** 撮る前に現れているべき要素の CSS 選択子（{@link Screen.settled}）。 */
      readonly settled?: string;
    }
  | {
      readonly route: string;
      /** 開かない理由と、その理由が消える条件。 */
      readonly skip: string;
    };

/**
 * 巡回・撮影の対象と、対象から外す route の宣言。
 *
 * @remarks
 * 外してよいのは**開く手段が無い**画面だけです。「まだ書けていない」は理由になりません。
 */
export const SCREENS: readonly ScreenDeclaration[] = [
  // 入口はどのサイトにもあるので、題材を破棄しても残る（`src/app/sitemap.ts` / `src/proxy.ts` の
  // 戻り先 / `src/app/not-found.tsx` の導線がいずれもここを指す）。破棄後は最小の画面が置き直され、
  // route は同じまま中身だけが入れ替わる（`scripts/setup/remove-sample/sample-manifest.ts`）。
  { route: "/", name: "home", path: "/" },
  // sample:begin
  { route: "/products", name: "products", path: "/products" },
  {
    route: "/products/[id]",
    name: "product-detail",
    // モックは同じ URL へ同じ応答を返すため（`mocks/stable-responses.ts`）、ID を固定すれば
    // 中身も固定される。存在する ID である必要はない — 契約駆動のモックはどの ID にも応える。
    path: "/products/0195f0c2-0000-7000-8000-000000000001",
  },
  { route: "/cart", name: "cart", path: "/cart" },
  { route: "/checkout", name: "checkout", path: "/checkout", signedIn: "user" },
  {
    route: "/checkout/complete",
    name: "checkout-complete",
    // 完了は成立した購入 1 件を指して開く。モックは同じ URL へ同じ応答を返すため、ID を固定
    // すれば中身も固定される（`mocks/stable-responses.ts`）。
    path: "/checkout/complete?purchase=0195f0c2-0000-7000-9000-000000000001",
    signedIn: "user",
  },
  { route: "/purchases", name: "purchases", path: "/purchases", signedIn: "user" },
  {
    route: "/purchases/[code]",
    name: "purchase-detail",
    // モックは同じ URL へ同じ応答を返すため（`mocks/stable-responses.ts`）、ID を固定すれば
    // 中身も固定される。存在する ID である必要はない — 契約駆動のモックはどの ID にも応える。
    path: "/purchases/0195f0c2-0000-7000-9000-000000000001",
    signedIn: "user",
  },
  { route: "/mypage", name: "mypage", path: "/mypage", signedIn: "user" },
  { route: "/mypage/edit", name: "profile-edit", path: "/mypage/edit", signedIn: "user" },
  {
    route: "/onboarding",
    skip:
      "開く手段が無い。認証は済んでいるが利用者の記録がまだ無い主体だけが入れる画面で、" +
      "契約から生成したモックは `/v1/users/me` に必ず応えるため、その状態を作れない。" +
      "登録済みの主体で開くと戻り先へ送り返される。撤去条件は、モックが未登録の主体を" +
      "表せるようになったとき",
  },
  { route: "/about", name: "about", path: "/about" },
  { route: "/privacy", name: "privacy", path: "/privacy" },
  { route: "/terms", name: "terms", path: "/terms" },
  { route: "/admin", name: "admin-dashboard", path: "/admin", signedIn: "admin" },
  {
    route: "/admin/analytics",
    name: "admin-analytics",
    path: "/admin/analytics",
    signedIn: "admin",
  },
  { route: "/admin/products", name: "admin-products", path: "/admin/products", signedIn: "admin" },
  {
    route: "/admin/products/new",
    name: "admin-product-new",
    path: "/admin/products/new",
    signedIn: "admin",
  },
  {
    route: "/admin/products/[id]/edit",
    name: "admin-product-edit",
    // 詳細と同じ理由で ID を固定する。契約駆動のモックはどの ID にも同じ応答を返す。
    path: "/admin/products/0195f0c2-0000-7000-9000-000000000001/edit",
    signedIn: "admin",
  },
  {
    route: "/admin/products/[id]/stock",
    name: "admin-product-stock",
    // 編集と同じ理由で ID を固定する。
    path: "/admin/products/0195f0c2-0000-7000-9000-000000000001/stock",
    signedIn: "admin",
  },
  {
    route: "/admin/shipments",
    name: "admin-shipments",
    path: "/admin/shipments",
    signedIn: "admin",
  },
  { route: "/admin/users", name: "admin-users", path: "/admin/users", signedIn: "admin" },
  // sample:end
  { route: "/login", name: "login", path: "/login" },
  // `APP_MAINTENANCE_MODE` を立てずに撮れる（判定は入口が持つ。理由は
  // `src/features/maintenance/README.md` の「状態とデザイン参照」）。
  { route: "/maintenance", name: "maintenance", path: "/maintenance" },
  { route: DEV_SESSION_PATH, name: "dev-session", path: DEV_SESSION_PATH },
  { route: "/_not-found", name: "not-found", path: "/この経路は存在しない" },
  {
    route: "/_global-error",
    skip:
      "URL では開けない。root layout の描画が失敗したときだけ React が差し替える面であり、" +
      "通常の遷移では到達しない。撤去条件は、E2E から root layout の失敗を起こす手段が" +
      "用意されたとき",
  },
];

/**
 * build の出力から画面の route を取り出す。
 *
 * @remarks
 * Route Handler（`/route`）は落とします。返すのは面を持つものだけです。
 *
 * 1 件も取れなければ例外を投げます。0 件へ縮退させると、画面を 1 つも開かない実行が「異常なし」
 * として緑で通ります。
 */
export function listScreenRoutes(json: string): string[] {
  const manifest = JSON.parse(json) as Record<string, unknown>;
  const routes = Object.entries(manifest)
    .filter(([appPath, route]) => appPath.endsWith(PAGE_SUFFIX) && typeof route === "string")
    .map(([, route]) => route as string)
    .sort();

  if (routes.length === 0) {
    throw new Error(`${SCREEN_MANIFEST_FILE} に画面がありません`);
  }

  return routes;
}

/**
 * build が出した route と宣言を突き合わせ、開く画面を返す。
 *
 * @remarks
 * 宣言の無い route があれば落とします。足した画面が黙って対象外になるのを防ぐためで、これが
 * 一覧を build の出力から取っている理由そのものです。
 *
 * 実体の無い宣言も落とします。消した・改名した画面を指す宣言が残ると、外した理由が実体を
 * 失ったまま居座ります。
 */
export function resolveScreens(
  routes: readonly string[],
  declarations: readonly ScreenDeclaration[],
): Screen[] {
  const declared = new Map(declarations.map((entry) => [entry.route, entry]));
  const undeclared = routes.filter((route) => !declared.has(route));

  if (undeclared.length > 0) {
    throw new Error(
      `画面の宣言がありません: ${undeclared.join(", ")}（e2e/lib/screens.ts へ追記してください）`,
    );
  }

  const known = new Set(routes);
  const stale = declarations.map((entry) => entry.route).filter((route) => !known.has(route));

  if (stale.length > 0) {
    throw new Error(`宣言が指す画面がありません: ${stale.toSorted().join(", ")}`);
  }

  const screens = declarations
    .filter((entry): entry is Extract<ScreenDeclaration, { name: string }> => "name" in entry)
    .map(({ route, name, path, signedIn, mask, settled }) => ({
      route,
      name,
      path,
      signedIn,
      mask,
      settled,
    }));

  const malformed = screens.filter((screen) => !SCREEN_NAME.test(screen.name));

  if (malformed.length > 0) {
    throw new Error(
      `画面の名前が採れる形ではありません: ${malformed.map((screen) => screen.name).join(", ")}` +
        "（小文字・数字・ハイフンだけで綴ってください）",
    );
  }

  return screens;
}

/**
 * 撮影対象を、名前で指定された範囲へ絞る。
 *
 * @remarks
 * 該当が 1 件も無ければ例外を投げます。0 件で続けると、撮り直しが「撮る対象なし」のまま成功し、
 * 承認の経路は絵が変わったつもりで進みます。
 *
 * 範囲を絞った実行では 1 対 1 の対応を見ないでください。在るべき画像の集合が絞った側に縮み、
 * 対象外の画像がすべて孤児として上がります（`visual/screens.spec.ts`）。
 *
 * @param screens - 絞る前の撮影対象
 * @param only - 画面の名前をカンマで並べたもの。空なら絞らない
 */
export function selectScreens(screens: readonly Screen[], only: string | undefined): Screen[] {
  if (!only) return [...screens];
  const wanted = new Set(only.split(",").map((name) => name.trim()));
  const selected = screens.filter((screen) => wanted.has(screen.name));
  if (selected.length === 0) throw new Error(`E2E_ONLY に該当する画面がありません: ${only}`);

  return selected;
}

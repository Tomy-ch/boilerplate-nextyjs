import type { Screen } from "../../e2e/lib/screens";
import { type Shard, selectShard } from "./shard";

/**
 * 何を計測するかの組み立て。
 *
 * @remarks
 * 開く画面は [`e2e/lib/screens.ts`](../../e2e/lib/screens.ts) の宣言をそのまま使い、一覧をここで
 * 持ち直しません。
 */

/** 計測 1 件ぶんの指示。 */
export type Target = {
  /** 画面の名前。判定と表に出る。 */
  readonly name: string;
  /** 実際に開く URL。 */
  readonly url: string;
  /** 開く前に作る session の役割。要らない画面では `undefined`。 */
  readonly role: string | undefined;
};

/**
 * 画面の宣言から計測の指示を組み立てる。
 *
 * @param screens - `resolveScreens` が返した画面。
 * @param baseUrl - アプリの待ち受け先。
 *
 * @remarks
 * URL の組み立てを `URL` に任せるのは、宣言のパスが query を持つことと、ASCII の外の文字を
 * 持つことがあるためです（`/この経路は存在しない`）。文字列の連結で組むと、前者は二重の `?` に、
 * 後者は Chrome が拒む URL になります。
 */
export function planTargets(screens: readonly Screen[], baseUrl: string): Target[] {
  return screens.map((screen) => ({
    name: screen.name,
    url: new URL(screen.path, baseUrl).toString(),
    role: screen.signedIn,
  }));
}

/** この台が測る画面の組み立て。 */
export type ScreenPlan = {
  /** 測る画面。担当ぶんに、足すなら床が続く。 */
  readonly screens: readonly Screen[];
  /** 担当ではないのに測る床の画面。足さないときは `undefined`。 */
  readonly control: Screen | undefined;
};

/**
 * この台が測る画面を決める。
 *
 * @remarks
 * **床の画面は、担当でない台でも測ります。** 落ちた画面と床が別の機械で測られていては、その
 * 画面が遅いのか機械が遅いのかを見比べられないためです
 * （`performance-budget.yaml` の `floor.reason`）。
 *
 * **割らない実行では足しません。** 全画面が同じ機械で測られるので、床は既に居ます。
 *
 * **絞りが床を落としたときも足しません。** 1 枚を見たいだけの実行に、頼んでいない画面が増える
 * のは筋が違います（絞った実行はそもそも割りません）。
 *
 * @param selected - 絞りを通した後の全画面。
 * @param shard - 何台目か / 何台に割ったか。
 * @param floorScreen - 床の画面の名前。
 */
export function planScreens(
  selected: readonly Screen[],
  shard: Shard,
  floorScreen: string,
): ScreenPlan {
  const screens = selectShard(selected, shard);

  if (shard.total < 2) {
    return { screens, control: undefined };
  }

  const floor = selected.find((screen) => screen.name === floorScreen);

  if (floor === undefined || screens.includes(floor)) {
    return { screens, control: undefined };
  }

  return { screens: [...screens, floor], control: floor };
}

// pin が冷却の窓を満たすか、免除が様式を満たすかの判定。読み取りは lib/mise-pins.ts、公開日時の
// 取得は published.ts が持ち、ここは受け取った値だけを見る。

import { IGNORE_DIRECTIVE, type MisePin, pinId } from "../lib/mise-pins.js";
import { calendarDay, dayAfter, daysSince, latestDateIn } from "../lib/withdrawal-date.js";
import type { Channel, Route } from "./published.js";

/** 配布経路ごとの窓（日数）。 */
export type Windows = Readonly<Record<Channel, number>>;

/** 公開日時の取得の結果。取れなかったことは、取れて古かったことと区別して持つ。 */
export type Lookup =
  | { readonly kind: "published"; readonly at: Date }
  | { readonly kind: "failed"; readonly reason: string };

/**
 * pin 1 件の判定。
 *
 * - `clear` — 窓を満たしている
 * - `exempt` — 窓の内側だが、様式を満たす免除がある
 * - `excluded` — 窓の対象外。棚卸しに載せるが、窓では判定しない
 * - `violation` — 窓の内側で免除が無い、免除が様式を満たさない、または要らない免除が残っている
 * - `unresolved` — 公開日時を引けず、判定できていない
 */
export type Judgement = {
  readonly pin: MisePin;
  readonly verdict: "clear" | "exempt" | "excluded" | "violation" | "unresolved";
  readonly message: string;
};

/**
 * base に無かった pin を選ぶ。同じキーでも版が違えば新しい pin として数える。
 *
 * @param base - base 時点の pin
 * @param current - 作業ツリーの pin
 */
export function addedPins(
  base: readonly MisePin[],
  current: readonly MisePin[],
): readonly MisePin[] {
  const known = new Set(base.map(pinId));

  return current.filter((pin) => !known.has(pinId(pin)));
}

/**
 * 窓の宣言を読む。
 *
 * @param options - `--<name> <value>` の表
 * @throws 経路のどれかに窓が無いとき、または非負の整数でないとき。**既定を置きません** ——
 * 窓の無い経路を 0 日として通すと、その経路の検疫が黙って消えます
 */
export function parseWindows(options: ReadonlyMap<string, string>): Windows {
  const days = (option: string): number => {
    const value = options.get(option);

    if (value === undefined || !/^\d+$/.test(value)) {
      throw new Error(`--${option} に非負の整数を渡してください`);
    }

    return Number(value);
  };

  return {
    "github-release": days("release-days"),
    registry: days("registry-days"),
  };
}

/**
 * pin 1 件を判定する。
 *
 * @remarks
 * 免除は窓の内側に居る pin にだけ意味を持ちます。窓を満たした pin や窓の対象外の pin に免除が
 * 残っていれば、それは効いていない宣言なので違反として返します —— 週次の棚卸しを待たず、その
 * pin を動かした変更の中で外させるためです。
 *
 * 窓の対象外の pin は公開日時を見ません。`lookup` が何であっても `excluded` です。
 *
 * @param pin - 判定する pin
 * @param route - backend の扱い
 * @param lookup - 公開日時の取得の結果。引いていなければ null
 * @param windows - 経路ごとの窓
 * @param now - 現在の時刻
 */
export function judgePin(
  pin: MisePin,
  route: Route,
  lookup: Lookup | null,
  windows: Windows,
  now: Date,
): Judgement {
  if (route.kind === "excluded") {
    if (pin.ignore !== null) {
      return {
        pin,
        verdict: "violation",
        message: `窓の対象外の pin に免除があります。${pin.ignore.line} 行目の免除を外してください`,
      };
    }

    return { pin, verdict: "excluded", message: "言語ランタイムは窓の対象外（受容するリスク）" };
  }

  if (route.kind === "none") {
    return {
      pin,
      verdict: "unresolved",
      message: `${pin.key} の backend は公開日時を引く経路を持ちません（検査できません）`,
    };
  }

  if (lookup === null) {
    return { pin, verdict: "unresolved", message: "公開日時を引いていません" };
  }

  if (lookup.kind === "failed") {
    return { pin, verdict: "unresolved", message: `公開日時を引けません: ${lookup.reason}` };
  }

  const window = windows[route.channel];
  const age = daysSince(lookup.at, now);
  const published = calendarDay(lookup.at);
  const clearsOn = dayAfter(lookup.at, window);

  if (age >= window) {
    if (pin.ignore !== null) {
      return {
        pin,
        verdict: "violation",
        message: `窓を満たしている（公開 ${published}、経過 ${age} 日）のに免除が残っています。${pin.ignore.line} 行目の免除を外してください`,
      };
    }

    return {
      pin,
      verdict: "clear",
      message: `公開 ${published}、経過 ${age} 日（窓 ${window} 日）`,
    };
  }

  if (pin.ignore === null) {
    return {
      pin,
      verdict: "violation",
      message: `公開 ${published} から ${age} 日で、窓（${window} 日）の内側です。${clearsOn} 以降に上げるか、pin の直上に「# ${IGNORE_DIRECTIVE} <理由>。${clearsOn} に外す」を置いてください`,
    };
  }

  const dueDate = latestDateIn(pin.ignore.condition);

  if (dueDate === undefined) {
    return {
      pin,
      verdict: "violation",
      message: `免除に日付がありません。窓が明ける ${clearsOn} を撤回の日として書いてください`,
    };
  }

  if (dueDate < clearsOn) {
    return {
      pin,
      verdict: "violation",
      message: `免除の期限 ${dueDate} が窓の明ける ${clearsOn} より前です。期限を ${clearsOn} 以降にしてください`,
    };
  }

  return {
    pin,
    verdict: "exempt",
    message: `窓の内側（公開 ${published}、経過 ${age} 日）ですが免除があります（期限 ${dueDate}）: ${pin.ignore.condition}`,
  };
}

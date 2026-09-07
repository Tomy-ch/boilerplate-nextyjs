"use client";

import { useEffect, useRef, useState } from "react";

import {
  MAX_DISTANCE,
  PULL_STATE,
  type PullState,
  RESISTANCE,
  TRIGGER_DISTANCE,
} from "./pull-to-refresh.definition";

/** 引ける環境かどうかの判定。touch を持たない環境では出す意味が無い。 */
const COARSE_POINTER = "(pointer: coarse)";

/** 引っ張りの観測結果。 */
export type PullGesture = {
  /** この環境で引っ張り操作を受け付けるか。**サーバでは常に false**。 */
  readonly enabled: boolean;
  /** いまの段階。取り直し中かどうかは呼び出し元が持つ。 */
  readonly state: PullState;
  /** 引かれている量（px）。目印の移動量に使う。 */
  readonly distance: number;
};

/**
 * 画面の上端から引き下げる操作を観測する。
 *
 * @remarks
 * 使うのがこの器だけなので中へ置いています。
 *
 * **ブラウザ既定の引き下げ更新を、この観測が生きている間だけ止めます。** 静的な CSS へ
 * `overscroll-behavior` を書くと、この機構を載せていないページでも既定が消え、引いても何も
 * 起きない状態が残ります。要素の生存期間に紐付けて付け外しします。
 *
 * サーバでは `enabled` が false になり、何も描かれません。引くまで見えるものが無いので、
 * hydration の前後で配置は動きません（[rendering.md](../../../../docs/design/rendering.md)）。
 *
 * 引き量に抵抗を掛け、上限を設けています。等倍かつ無制限だと、指を少し動かしただけで実行の域に
 * 入り、引き続けるほど画面がずれ続けます。
 *
 * 監視は passive で登録します。`preventDefault` に頼らず `overscroll-behavior` で既定を止めて
 * いるため、scroll を止める必要がありません。
 *
 * modal が開いている間は拾いません（{@link isModalOpen}）。
 *
 * @param onRelease - 実行の域まで引いた状態で指を離したときに呼ばれる
 */
/**
 * 画面のどこかに modal が開いているか。
 *
 * @remarks
 * **modal は 2 通りに名乗ります。** 面そのものが `aria-modal` を立てるか、背面を `aria-hidden` /
 * `inert` で閉じるかです。どちらも ARIA の語彙であって特定の overlay ライブラリの印ではありません。
 * **片方だけを見ると効きません**
 * —— この repo が使う Radix は「`aria-modal` と等価でより広く支持される」として後者を採り、属性を
 * 出しません。逆に後者だけを見ると、背面を閉じずに名乗る実装を取り逃がします。
 *
 * **背面が閉じているかは landmark を起点に見ます。** 触れた要素から辿ると、装飾のアイコンに付く
 * `aria-hidden` を modal と取り違え、modal が無いのに引けなくなります。`main` は本文そのものなので
 * 装飾の理由で隠れることがありません。
 */
function isModalOpen(): boolean {
  if (document.querySelector('[aria-modal="true"]') !== null) {
    return true;
  }

  const main = document.querySelector("main");

  return main !== null && main.closest('[aria-hidden="true"], [inert]') !== null;
}

export function usePullGesture(onRelease: () => void): PullGesture {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<PullState>(PULL_STATE.IDLE);
  const [distance, setDistance] = useState(0);
  const originRef = useRef<number | null>(null);
  const pointerRef = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const releaseRef = useRef(onRelease);

  useEffect(() => {
    releaseRef.current = onRelease;
  }, [onRelease]);

  useEffect(() => {
    const query = window.matchMedia(COARSE_POINTER);
    const sync = () => setEnabled(query.matches);

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;

    root.style.overscrollBehaviorY = "contain";

    return () => {
      root.style.overscrollBehaviorY = previous;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const reset = () => {
      originRef.current = null;
      pointerRef.current = null;
      distanceRef.current = 0;
    };

    const start = (event: TouchEvent) => {
      // 上端にいないときは通常の scroll。ここで拾うと途中から引き戻す操作を奪う。
      // modal が開いている間も拾わない。背面の取り直しは利用者が求めた操作ではない。
      // 2 本目が触れた時点でも降りる。拡大や 2 本指の scroll を引き下げと取り違えない。
      const blocked = window.scrollY > 0 || event.touches.length > 1 || isModalOpen();
      const touch = blocked ? undefined : event.touches[0];

      if (touch === undefined) {
        reset();
        setDistance(0);
        setState(PULL_STATE.IDLE);

        return;
      }

      originRef.current = touch.clientY;
      pointerRef.current = touch.identifier;
    };

    const move = (event: TouchEvent) => {
      const origin = originRef.current;
      // 追うのは引き始めた指だけ。別の指を基準にすると、基準点が入れ替わって引き量が飛ぶ。
      const current = [...event.touches].find(
        (touch) => touch.identifier === pointerRef.current,
      )?.clientY;

      if (origin === null || current === undefined) {
        return;
      }

      const pulled = Math.max(Math.min((current - origin) * RESISTANCE, MAX_DISTANCE), 0);

      distanceRef.current = pulled;
      setDistance(pulled);

      if (pulled >= TRIGGER_DISTANCE) {
        setState(PULL_STATE.READY);
      } else if (pulled > 0) {
        setState(PULL_STATE.PULLING);
      } else {
        setState(PULL_STATE.IDLE);
      }
    };

    const end = (event: TouchEvent) => {
      // 離れたのが引き始めた指でなければ、引き下げはまだ続いている。
      const released = [...event.changedTouches].some(
        (touch) => touch.identifier === pointerRef.current,
      );

      if (pointerRef.current === null || !released) {
        return;
      }

      const reached = distanceRef.current >= TRIGGER_DISTANCE;

      reset();
      setDistance(0);
      setState(PULL_STATE.IDLE);

      if (reached) {
        releaseRef.current();
      }
    };

    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", end, { passive: true });

    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, [enabled]);

  return { enabled, state, distance };
}

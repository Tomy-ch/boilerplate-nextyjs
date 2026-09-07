"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * 履歴に積んだ 1 件が、どの overlay のものかを示す印。
 *
 * @remarks
 * 印は overlay ごとに異なる値を持ちます。有無だけを見ると、重ねて開いた内側から戻ったときに
 * 外側の印を自分のものと読み違えます。
 */
const OVERLAY_HISTORY_MARKER = "overlayHistory";

/** {@link useOverlayHistory} が受け取る開閉の指定。Radix の Root と同じ形。 */
export type OverlayHistoryOptions = {
  /** 外から制御する場合の開閉状態。 */
  open?: boolean;
  /** 制御しない場合の初期状態。 */
  defaultOpen?: boolean;
  /** 開閉が変わったときに呼ぶ。 */
  onOpenChange?: (open: boolean) => void;
};

/** 開閉状態と、その切り替え口。 */
export type OverlayHistory = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

/**
 * 背面を塞ぐ overlay を、戻る操作で閉じられるようにする。
 *
 * @remarks
 * **開いた時点で履歴を 1 つ積みます。** 戻る操作の意味は「いま被さっているものを外す」であって
 * 「前の画面へ移る」ではありません。積まないと、被せたまま戻ったときに画面ごと移り、読んでいた
 * 内容も入力も失われます（[0053](../../../../docs/adr/0053-ui-component-interaction-seam.md)）。
 *
 * **閉じる操作で閉じたときは、積んだぶんを戻します。** 打ち消さないと、開いて閉じただけで履歴が
 * 1 つ増え、戻る操作が何も起きない回になります。
 *
 * **画面を移す操作で閉じたときは戻しません。** 移った先で戻すと、遷移そのものが取り消されます。
 * 積んだ時点の URL と印の両方を見て、自分の 1 件がまだ最前面にあるときだけ戻します。
 *
 * **この判定が見分けられるのは、URL が既に動いた遷移だけです。** client 側の遷移は取得が終わる
 * まで URL を動かさないため、閉じる操作と遷移を同じ操作で撃つと、ここは「まだ最前面」と読んで
 * 戻し、その戻しが遷移を消します。**overlay の中から遷移するときは、閉じる操作を同時に撃たず、
 * 遷移が届いたことで閉じてください**（`docs/rules.md`「UI 部品と操作」の「overlay の中から遷移するときは
 * 閉じる操作を同時に撃たない」）。積んだ 1 件は結果で差し替えます——そのうえで積むと、戻る操作が
 * 1 度空振りします。
 *
 * 制御されている（`open` を渡された）場合も同じように積みます。開閉の持ち主が誰であっても、
 * 戻る操作の意味は変わらないためです。
 */
export function useOverlayHistory({
  open,
  defaultOpen = false,
  onOpenChange,
}: OverlayHistoryOptions): OverlayHistory {
  const historyId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : uncontrolledOpen;
  const pushedRef = useRef(false);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }

      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  // 積むのは開いた 1 回だけにする。切り替え口を効果の依存に置くと、呼び出し側が毎回作り直す
  // `onOpenChange` を渡しただけで積み直しが起き、打ち消しのために積んだぶんを戻す動きが遅れて
  // 届いて overlay がひとりでに閉じる。
  const setOpenRef = useRef(setOpen);

  useEffect(() => {
    setOpenRef.current = setOpen;
  }, [setOpen]);

  useEffect(() => {
    if (!currentOpen) {
      return;
    }

    const pushedHref = window.location.href;

    window.history.pushState({ ...window.history.state, [OVERLAY_HISTORY_MARKER]: historyId }, "");
    pushedRef.current = true;

    const handlePopState = () => {
      // 自分の印が残っているなら、離れたのは自分の 1 件ではない。同じ文書の中での移動でも
      // popstate は届くため、届いたことだけを閉じる合図にすると、開いた直後に閉じる。
      if (window.history.state?.[OVERLAY_HISTORY_MARKER] === historyId) {
        return;
      }

      pushedRef.current = false;
      setOpenRef.current(false);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      const isStillOnTop =
        pushedRef.current &&
        window.location.href === pushedHref &&
        window.history.state?.[OVERLAY_HISTORY_MARKER] === historyId;

      pushedRef.current = false;

      if (isStillOnTop) {
        window.history.back();
      }
    };
  }, [currentOpen, historyId]);

  return { open: currentOpen, setOpen };
}

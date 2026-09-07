"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { cn } from "@/components/cn";
import { Spinner } from "@/components/design-system/status/spinner/spinner";

import { APPEAR_DISTANCE, PULL_STATE } from "./pull-to-refresh.definition";
import { usePullGesture } from "./use-pull-gesture";

/**
 * 画面の上端から引き下げて、いまの route を取り直す。
 *
 * @remarks
 * 何を取り直すかを知りません。`router.refresh()` はサーバに現在の route を描き直させるだけで、
 * どの画面に置いても同じ意味になります。画面ごとの再取得の中身はそれぞれの画面が持ち、この器は
 * 合図を送るところまでを担います。
 *
 * **ブラウザの再読み込みとは別物です。** client state が保たれるため、開いている入力や一時的な
 * 選択が消えません（[rendering.md](../../../../docs/design/rendering.md)）。
 *
 * 進行の判定を `useTransition` に委ねているのは、`router.refresh()` が完了を返さないためです。
 * 自前で時間を決めて畳むと、実際の取得より早く消えるか、終わっても回り続けます。
 *
 * touch を持たない環境では何も描きません。引く手段が無い場所に目印だけ出しても操作へ
 * つながらないためです。
 *
 * @see Storybook `Shell/PullToRefresh`
 */
export function PullToRefresh() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);
  const { enabled, state, distance } = usePullGesture(refresh);

  if (!enabled) {
    return null;
  }

  const shown = refreshing || distance >= APPEAR_DISTANCE;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      data-slot="pull-to-refresh"
      data-state={refreshing ? PULL_STATE.REFRESHING : state}
    >
      <div
        className={cn(
          "mt-2 flex size-9 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-opacity",
          shown ? "opacity-100" : "opacity-0",
        )}
        // 引いた量にそのまま追従させる。指の位置と目印がずれると、どこまで引けば実行されるかが読めない。
        style={{ transform: `translateY(${refreshing ? APPEAR_DISTANCE * 2 : distance}px)` }}
      >
        {refreshing ? (
          <Spinner className="size-5 text-muted-foreground" label="再読み込みしています" />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "size-2.5 rounded-full transition-colors",
              state === PULL_STATE.READY ? "bg-foreground" : "bg-muted-foreground/50",
            )}
          />
        )}
      </div>
    </div>
  );
}

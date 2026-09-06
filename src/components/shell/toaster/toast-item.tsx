"use client";

import type { PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/design-system/action/button/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";
import { ProgressClient } from "@/components/design-system/status/progress-client/progress-client";
import { XIcon } from "@/components/icon";

import {
  TOAST_POSITION,
  TOAST_SWIPE_THRESHOLD_PX,
  TOAST_TICK_INTERVAL_MS,
  TOAST_VARIANT,
  type Toast,
  type ToastPosition,
} from "./toaster.definition";

/** 通知を払いのける向き。0 はその軸へ払えないことを表す。 */
function swipeDirection(position: ToastPosition): { horizontal: number; vertical: number } {
  const vertical =
    position === TOAST_POSITION.TOP_LEFT ||
    position === TOAST_POSITION.TOP_CENTER ||
    position === TOAST_POSITION.TOP_RIGHT
      ? -1
      : 1;
  const horizontal =
    position === TOAST_POSITION.TOP_LEFT || position === TOAST_POSITION.BOTTOM_LEFT
      ? -1
      : position === TOAST_POSITION.TOP_RIGHT || position === TOAST_POSITION.BOTTOM_RIGHT
        ? 1
        : 0;

  return { horizontal, vertical };
}

const NO_DRAG = { x: 0, y: 0 };

/**
 * 通知一件の表示。
 *
 * @remarks
 * 残り時間の計測と、払いのけて閉じる操作をここで持つ。積み方と配置は領域側の責務であり、
 * この component は自分が置かれた向き（`position`）を、払いのける向きの決定にだけ使う。
 *
 * @param props.toast - 表示する通知。
 * @param props.onDismiss - 閉じたときに `id` を渡す callback。自動で閉じた場合も呼ばれる。
 * @param props.position - 通知が積まれている隅。払いのける向きを決める。
 * @param props.paused - 自動で閉じる計時を止めるか。領域が hover / focus されている間に立つ。
 *   掴んでいる間とタブが背面にある間は、この値によらず止まる。
 *
 * @see Storybook `Feedback/Toaster`
 */
export function ToastItem({
  toast,
  onDismiss,
  position,
  paused,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  position: ToastPosition;
  paused: boolean;
}) {
  const [remaining, setRemaining] = useState(toast.duration ?? 0);
  const [drag, setDrag] = useState(NO_DRAG);
  const remainingRef = useRef(toast.duration ?? 0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  const dismiss = useCallback(() => onDismiss(toast.id), [onDismiss, toast.id]);
  const runAction = useCallback(() => {
    toast.action?.onClick();
    onDismiss(toast.id);
  }, [onDismiss, toast.action, toast.id]);

  useEffect(() => {
    const duration = toast.duration;
    if (duration === undefined || duration <= 0) return;
    remainingRef.current = duration;
    let measuredAt = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - measuredAt;
      measuredAt = now;
      // 読もうとしている間・掴んでいる間・タブが背面にある間は、誰も読み終えていないか
      // 誰も見ていない。経過を計上せず表示時間を保つ。
      if (document.hidden || pausedRef.current || startRef.current !== null) return;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      setRemaining(remainingRef.current);
      if (remainingRef.current === 0) {
        window.clearInterval(timer);
        onDismiss(toast.id);
      }
    }, TOAST_TICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [onDismiss, toast.duration, toast.id]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = startRef.current;
      if (start === null) return;
      const { horizontal } = swipeDirection(position);
      setDrag({
        x: horizontal === 0 ? 0 : event.clientX - start.x,
        y: event.clientY - start.y,
      });
    },
    [position],
  );

  const handlePointerUp = useCallback(() => {
    if (startRef.current === null) return;
    startRef.current = null;
    const { horizontal, vertical } = swipeDirection(position);
    const swipedAway =
      (horizontal !== 0 && drag.x * horizontal >= TOAST_SWIPE_THRESHOLD_PX) ||
      drag.y * vertical >= TOAST_SWIPE_THRESHOLD_PX;

    if (swipedAway) {
      onDismiss(toast.id);
      return;
    }
    setDrag(NO_DRAG);
  }, [drag.x, drag.y, onDismiss, position, toast.id]);

  const dragging = drag.x !== 0 || drag.y !== 0;

  return (
    // 通知は任意のページ内容の上へ重なるため、面は不透明でなければならない。variant の
    // `warning` / `destructive` は文脈内の Alert 向けに 10% の色を敷くだけなので、
    // 下地をここで与える。
    <div
      className="pointer-events-auto touch-none rounded-lg bg-background shadow-lg"
      data-slot="toast"
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={dragging ? { transform: `translate(${drag.x}px, ${drag.y}px)` } : undefined}
    >
      <Alert
        role={toast.variant === TOAST_VARIANT.DESTRUCTIVE ? "alert" : "status"}
        variant={toast.variant}
      >
        <AlertTitle className="font-emphasis">{toast.title}</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1">{toast.description}</span>
          {toast.action === undefined ? null : (
            <Button onClick={runAction} size="sm" type="button" variant="outline">
              {toast.action.label}
            </Button>
          )}
          <Button
            aria-label="通知を閉じる"
            onClick={dismiss}
            size="sm"
            type="button"
            variant="ghost"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </AlertDescription>
        {toast.duration === undefined || toast.duration <= 0 ? null : (
          <ProgressClient
            aria-label={`通知はあと${Math.ceil(remaining / 1000)}秒で閉じます`}
            className="col-start-2 mt-2 h-1"
            indicatorClassName="duration-100 ease-linear"
            max={toast.duration}
            value={remaining}
          />
        )}
      </Alert>
    </div>
  );
}

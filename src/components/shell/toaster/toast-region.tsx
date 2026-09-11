"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/components/cn";

import { ToastItem } from "./toast-item";
import {
  TOAST_POSITION,
  TOAST_STACK_OFFSET_PX,
  TOAST_STACK_SCALE_STEP,
  type Toast,
  type ToastHotkey,
  type ToastPosition,
} from "./toaster.definition";

const POSITION_CLASS: Readonly<Record<ToastPosition, string>> = {
  [TOAST_POSITION.TOP_LEFT]: "top-4 left-4",
  [TOAST_POSITION.TOP_CENTER]: "top-4 left-1/2 -translate-x-1/2",
  [TOAST_POSITION.TOP_RIGHT]: "top-4 right-4",
  [TOAST_POSITION.BOTTOM_LEFT]: "bottom-4 left-4",
  [TOAST_POSITION.BOTTOM_CENTER]: "bottom-4 left-1/2 -translate-x-1/2",
  [TOAST_POSITION.BOTTOM_RIGHT]: "bottom-4 right-4",
};

/** 上端に積むかどうか。積む向きと、畳んだときに後ろの通知を覗かせる向きを決める。 */
function isTopAnchored(position: ToastPosition): boolean {
  return (
    position === TOAST_POSITION.TOP_LEFT ||
    position === TOAST_POSITION.TOP_CENTER ||
    position === TOAST_POSITION.TOP_RIGHT
  );
}

/** 畳んだ状態で、index 番目の通知を後ろへ下げる見た目。 */
function collapsedStyle(index: number, topAnchored: boolean, total: number): CSSProperties {
  const direction = topAnchored ? 1 : -1;

  return {
    gridArea: "1 / 1",
    transform: `translateY(${direction * index * TOAST_STACK_OFFSET_PX}px) scale(${1 - index * TOAST_STACK_SCALE_STEP})`,
    zIndex: total - index,
  };
}

/**
 * 配置・積み方・領域への到達手段を持つ、通知を積む領域。
 *
 * @remarks
 * 通知一件の描画と計時は `ToastItem` の責務で、queue の保持は Provider の責務である。
 *
 * 通知が複数あるとき、既定では重ねて畳み、hover または領域内へ focus が入ったときだけ
 * 展開する。全部を常に開いておきたい場合は `expand` を指定する。
 *
 * 領域自体は名前つきの landmark であり、`hotkey` で focus を移せる。pointer を持たない
 * 利用者が、消える前の通知へ到達するための唯一の手段になる。
 *
 * hover しているあいだと領域内へ focus が入っているあいだは、配下の通知の自動で閉じる
 * 計時を止める。読もうとしている最中に消えるのを避けるためであり、`expand` で常時展開
 * している場合は止めない（読んでいるとは限らないため）。
 *
 * @param props.toasts - 表示する通知。先頭が最も新しい。件数の上限は呼び出し元が絞る。
 * @param props.onDismiss - 通知が閉じられたときに `id` を渡す callback。
 * @param props.position - 積む隅。値の一覧は {@link TOAST_POSITION}。
 * @param props.expand - 常に展開して並べるか。既定では畳み、hover / focus で展開する。
 * @param props.hotkey - 領域へ focus を移すキー操作。
 * @param props.label - 領域のアクセシブルな名前。
 *
 * @see Storybook `Feedback/Toaster`
 */
export function ToastRegion({
  toasts,
  onDismiss,
  position,
  expand,
  hotkey,
  label,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position: ToastPosition;
  expand: boolean;
  hotkey: ToastHotkey;
  label: string;
}) {
  const regionRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { code, altKey, ctrlKey, metaKey, shiftKey } = hotkey;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== code) return;
      if (event.altKey !== Boolean(altKey)) return;
      if (event.ctrlKey !== Boolean(ctrlKey)) return;
      if (event.metaKey !== Boolean(metaKey)) return;
      if (event.shiftKey !== Boolean(shiftKey)) return;
      regionRef.current?.focus();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [altKey, code, ctrlKey, metaKey, shiftKey]);

  const handlePointerEnter = useCallback(() => setHovered(true), []);
  const handlePointerLeave = useCallback(() => setHovered(false), []);
  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  const topAnchored = isTopAnchored(position);
  const expanded = expand || hovered || focused;

  return (
    <section
      aria-label={label}
      className={cn("pointer-events-none fixed z-50 w-80", POSITION_CLASS[position])}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      ref={regionRef}
      tabIndex={-1}
    >
      <ol aria-live="polite" className="grid gap-2">
        {toasts.map((toast, index) => (
          <li
            key={toast.id}
            style={expanded ? undefined : collapsedStyle(index, topAnchored, toasts.length)}
          >
            <ToastItem
              onDismiss={onDismiss}
              paused={hovered || focused}
              position={position}
              toast={toast}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

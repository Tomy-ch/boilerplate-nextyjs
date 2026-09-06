"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CheckIcon, CopyIcon } from "@/components/icon";

import { Button, type ButtonProps } from "../button/button";
import { BUTTON_SIZE, BUTTON_VARIANT } from "../button/button.definition";

/**
 * 写した合図を表示し続ける時間（ミリ秒）。
 *
 * @see Storybook `Action/CopyButton`
 */
export const COPY_FEEDBACK_MS = 2000;

/** {@link CopyButton} の props。 */
export type CopyButtonProps = Omit<ButtonProps, "children" | "onClick" | "type"> & {
  /** clipboard へ写す文字列。表示している値と同じものを呼び出し元が渡す。 */
  value: string;
  /** 操作のアクセシブルな名前。何を写すのかが分かる語にする。 */
  label: string;
  /** 写した直後に読み上げる語。 */
  copiedLabel?: string;
};

/**
 * 値を clipboard へ写す操作。
 *
 * @remarks
 * clipboard を扱うため hydration が必要な client island であり、Server Component からは直接
 * render できない。写す値を表示する側は Server Component のまま保ち、この操作だけを分ける。
 *
 * 写す文字列は `value` として呼び出し元が渡す。表示している値と写る値がずれないよう、整形済みの
 * 同じ文字列を渡す。整形はこの部品が持たない。

 * clipboard そのものを `capabilities` の hook へ切り出していないのは、再利用したい実体が
 * browser 能力ではなく「写して、写せたと伝える操作」だからである。名前の必須化・読み上げ・合図の
 * 時間・失敗時の扱いはいずれも UI の決定で、hook へ移しても呼び出し元へ残る。ボタン以外の面
 * （menu 項目や shortcut）から写す必要が出た時点で、共有する部分を hook へ切り出す。
 *
 * clipboard は安全な文脈でしか使えず、利用者が許可しない場合もある。失敗しても例外は投げず、
 * 合図を出さないだけにとどめる。写せたかどうかを前提にした導線を feature 側で組まない。
 *
 * @remarks
 * `label` は必須である。アイコンだけの操作は、名前が無いと支援技術から用途が分からない。
 *
 * @param props - `Button` の props から `children` / `onClick` / `type` を除いたものに、上記を加えたもの。
 *
 * @see Storybook `Action/CopyButton`
 */
export function CopyButton({
  copiedLabel = "写しました",
  label,
  size = BUTTON_SIZE.SMALL,
  value,
  variant = BUTTON_VARIANT.GHOST,
  ...props
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }

    setIsCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsCopied(false), COPY_FEEDBACK_MS);
  }, [value]);

  return (
    <Button
      aria-label={label}
      data-slot="copy-button"
      onClick={copy}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {isCopied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      <span aria-live="polite" className="sr-only">
        {isCopied ? copiedLabel : ""}
      </span>
    </Button>
  );
}

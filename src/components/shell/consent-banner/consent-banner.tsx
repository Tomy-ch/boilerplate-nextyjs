"use client";

import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { CONSENT_CHOICE, type ConsentChoice } from "@/model/consent";
import { CONSENT_BANNER_COPY } from "./consent-banner.definition";

/** 閉じる操作を握り潰す。選ぶこと以外でこの面は閉じない。 */
function keepOpen(event: Event): void {
  event.preventDefault();
}

/** `ConsentBanner` の props。 */
export type ConsentBannerProps = {
  /** 尋ねている最中か。閉じている間は何も描かない。 */
  open: boolean;
  /** どちらかが選ばれたときに、その意思を受け取る callback。 */
  onDecide: (choice: ConsentChoice) => void;
  /** 判断の材料を示す文書の行き先。省略すると導線を出さない。 */
  policyHref?: string;
};

/**
 * 任意の用途に cookie を使ってよいかを、選び終えるまで尋ね続ける面。
 *
 * @remarks
 * **同意状態を持ちません。** いま尋ねているかどうかは `open` で渡され、選ばれた意思は
 * `onDecide` で呼び出し元へ返ります。判定と保存は供給側が持ちます。
 *
 * **閉じる手段を置きません。** Escape も、面の外を押す操作も、右上の × も受け付けません。
 * 選ばずに閉じられると「尋ねたが選ばれていない」状態が残り、次の描画でまた出ます。閉じる操作は
 * 選ぶことだけです。
 *
 * **背面を操作させません。** 選び終えるまで focus は面の中を回り、支援技術からも背面が読めなく
 * なります。焦点だけを閉じ込めて見た目の背面を開けておくと、見えている人と読み上げる人で操作
 * できる範囲が食い違います。
 *
 * **2 つの選択肢を同じ重さで並べます。** どちらも副次操作の見た目を採り、主要操作の強調は
 * どちらにも与えません。片方を目立たせると、同意が自由に与えられたものではなくなります。
 *
 * @param props.open - 尋ねている最中か
 * @param props.onDecide - 選ばれた意思を受け取る callback
 * @param props.policyHref - 判断の材料を示す文書の行き先
 *
 * @see Storybook `Overlay/ConsentBanner`
 */
export function ConsentBanner({ open, onDecide, policyHref }: ConsentBannerProps) {
  const deny = useCallback(() => onDecide(CONSENT_CHOICE.denied), [onDecide]);
  const grant = useCallback(() => onDecide(CONSENT_CHOICE.granted), [onDecide]);

  return (
    <DialogPrimitive.Root modal open={open}>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        data-slot="consent-banner-overlay"
      />
      <DialogPrimitive.Content
        className="fixed inset-x-0 bottom-0 z-50 border-border border-t bg-background p-6 text-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4"
        data-slot="consent-banner"
        onEscapeKeyDown={keepOpen}
        onInteractOutside={keepOpen}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="font-emphasis text-base">
              {CONSENT_BANNER_COPY.title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-muted-foreground text-sm">
              {CONSENT_BANNER_COPY.description}
              {policyHref ? (
                <>
                  {" "}
                  <Link
                    className="underline underline-offset-4 hover:text-foreground"
                    href={policyHref}
                  >
                    {CONSENT_BANNER_COPY.policy}
                  </Link>
                </>
              ) : null}
            </DialogPrimitive.Description>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button onClick={deny} variant={BUTTON_VARIANT.OUTLINE}>
              {CONSENT_BANNER_COPY.reject}
            </Button>
            <Button onClick={grant} variant={BUTTON_VARIANT.OUTLINE}>
              {CONSENT_BANNER_COPY.accept}
            </Button>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}

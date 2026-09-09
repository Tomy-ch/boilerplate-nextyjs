"use client";

import Image, { type ImageProps } from "next/image";
import { type ReactNode, useCallback, useId, useRef } from "react";

import { cn } from "@/components/cn";
import { Carousel, CarouselContent, CarouselItem } from "../../container/carousel/carousel";
import { CarouselNext, CarouselPrevious } from "../../container/carousel/carousel-navigation";
import {
  alignSlideToStart,
  CAROUSEL_CONTENT_SLOT,
  CAROUSEL_ITEM_SLOT,
  currentSlideIndex,
} from "../../container/carousel/carousel-scroll";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../dialog/dialog";

/** 拡大して見せる画像 1 枚。 */
export type ViewableImage = {
  readonly src: ImageProps["src"];
  /** 画像の説明。拡大版の代替テキストになる。 */
  readonly alt: string;
};

/** {@link ImageViewer} の props。 */
export type ImageViewerProps = {
  /** 送れる画像の全体。並び順は呼び出し元が決める。 */
  images: readonly ViewableImage[];
  /** この trigger が開く位置。 */
  index: number;
  /** trigger として描く縮小版。枠と比率は呼び出し元が決める。 */
  children: ReactNode;
  /** trigger に追加する class 名。 */
  className?: string;
};

/** 領域の中の N 枚目へ寄せる。枚数の外を指されても落とさない。 */
function alignToIndex(content: Element, index: number): void {
  const target = content.querySelectorAll(CAROUSEL_ITEM_SLOT)[index];

  if (target !== undefined) {
    alignSlideToStart(content, target);
  }
}

/**
 * 画像を押すと大きく開き、開いたまま前後へ送れる。
 *
 * @remarks
 * 縮小版を押せるようにするだけの部品です。並べ方・枠・比率は持たず、trigger の中身は呼び出し元が
 * 渡します。carousel に載せるのか単独で置くのかで枠が変わるためです。
 *
 * **trigger は `button` です。** 画像に click を付ける形は keyboard から辿れず、押せることも
 * 伝わりません。
 *
 * 拡大版も carousel です。1 枚だけを見せると、次を見るために閉じて選び直す往復が要ります。送りは
 * 本体と同じ機構（横スクロールと吸着）に乗るため、touch のスワイプがそのまま効きます。
 *
 * **位置は本体の carousel と往復します。** 開くときは押した位置から始め、閉じるときは拡大版で
 * 送り終えた位置へ本体を寄せます。合わせないと、拡大版で 3 枚目まで送って閉じたのに本体は 1 枚目の
 * まま、という食い違いが残ります。本体は DOM の先祖を辿って見つけるため、carousel の外へ置いた
 * 場合は開始位置だけが効き、寄せる相手が無いので何も起きません。
 *
 * 各 slide は viewport に対する箱へ `object-contain` で収めます。画像の実寸を知らずに原寸で描くと、
 * 縦長の画像が画面からはみ出して全体を見られません。切り抜かないのは、拡大が「全部を見る」ための
 * 操作だからです。
 *
 * 紙には出しません。押せない操作であり、拡大版は開いていなければ DOM にも居ません。
 *
 * @see Storybook `Overlay/ImageViewer`
 */
export function ImageViewer({ images, index, children, className }: ImageViewerProps) {
  const slidePrefix = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const viewerContentRef = useRef<HTMLDivElement>(null);
  const reachedRef = useRef(index);
  const slideIdOf = useCallback(
    (position: number) => `${slidePrefix}-image-${position + 1}`,
    [slidePrefix],
  );

  // 開いた直後は slide がまだ描かれていないため、ref が刺さった時点で寄せる。
  const startAtIndex = useCallback(
    (content: HTMLDivElement | null) => {
      viewerContentRef.current = content;

      if (content !== null) {
        alignToIndex(content, index);
      }
    },
    [index],
  );

  // 送り終えた位置は、拡大版がまだ描かれているこの時点でしか読めない。
  const rememberReached = useCallback(
    (open: boolean) => {
      const content = viewerContentRef.current;

      reachedRef.current = open || content === null ? index : currentSlideIndex(content);
    },
    [index],
  );

  /**
   * 本体を送り終えた位置へ寄せ、その位置の trigger へ focus を戻す。
   *
   * 既定の focus 復帰を止めるのは、押した trigger へ戻すとブラウザがその slide を画面内へ
   * 引き寄せ、寄せたばかりの位置が押し戻されるためである。止めた以上は自分で戻す。
   */
  const restoreToReached = useCallback((event: Event) => {
    const trigger = triggerRef.current;
    const host = trigger?.closest(CAROUSEL_CONTENT_SLOT);

    if (trigger === null || host === null || host === undefined) {
      return;
    }

    event.preventDefault();
    alignToIndex(host, reachedRef.current);

    const slide = host.querySelectorAll(CAROUSEL_ITEM_SLOT)[reachedRef.current];
    const reachedTrigger = slide?.querySelector('[data-slot="dialog-trigger"]');

    (reachedTrigger instanceof HTMLElement ? reachedTrigger : trigger).focus({
      preventScroll: true,
    });
  }, []);

  const current = images[index];

  if (current === undefined) {
    return null;
  }

  return (
    <Dialog onOpenChange={rememberReached}>
      <DialogTrigger
        aria-label={`${current.alt}を拡大する`}
        className={cn(
          "print-hidden block w-full cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary",
          className,
        )}
        ref={triggerRef}
      >
        {children}
      </DialogTrigger>
      {/* 既定の読み幅 (sm:max-w-lg) は文章のための値なので、変種ごと外して画像の幅を採る。 */}
      <DialogContent
        className="w-[min(92vw,72rem)] max-w-none p-2 sm:max-w-none"
        onCloseAutoFocus={restoreToReached}
      >
        <DialogTitle className="sr-only">{current.alt}</DialogTitle>
        <DialogDescription className="sr-only">
          画像を拡大して表示しています。左右に送れます。閉じるには Escape を押すか、右上の閉じるを
          選びます。
        </DialogDescription>
        <Carousel aria-label={`${current.alt}の拡大表示`}>
          <CarouselContent ref={startAtIndex}>
            {images.map((image, position) => (
              <CarouselItem
                aria-label={`${position + 1} / ${images.length}`}
                id={slideIdOf(position)}
                key={slideIdOf(position)}
              >
                <div className="relative h-[min(78vh,72rem)] w-full">
                  <Image
                    alt={image.alt}
                    className="object-contain"
                    fill
                    sizes="92vw"
                    src={image.src}
                  />
                </div>
                {/* 送る操作は画像より後ろに置く。位置指定要素は DOM の順で重なるため、
                    前に置くと画像に覆われて押せない。 */}
                {position === 0 ? null : <CarouselPrevious href={`#${slideIdOf(position - 1)}`} />}
                {position === images.length - 1 ? null : (
                  <CarouselNext href={`#${slideIdOf(position + 1)}`} />
                )}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </DialogContent>
    </Dialog>
  );
}

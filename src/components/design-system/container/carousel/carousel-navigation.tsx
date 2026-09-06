"use client";

import {
  type ComponentProps,
  createContext,
  type MouseEvent,
  type MouseEventHandler,
  useContext,
  useEffect,
  useState,
} from "react";

import { cn } from "@/components/cn";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icon";
import { CarouselNav } from "./carousel";
import { alignSlideToStart, CAROUSEL_CONTENT_SLOT, CAROUSEL_ITEM_SLOT } from "./carousel-scroll";

const CarouselCurrentContext = createContext<string | null>(null);

function slideIdOf(href: string) {
  return decodeURIComponent(href.slice(1));
}

function keepVisible(container: Element, target: Element) {
  const view = container.getBoundingClientRect();
  const box = target.getBoundingClientRect();

  if (box.left >= view.left && box.right <= view.right) {
    return;
  }

  container.scrollBy({
    left: box.left < view.left ? box.left - view.left : box.right - view.right,
  });
}

/** slide へ送る操作に共通の props。 */
export type CarouselNavigationProps = Omit<ComponentProps<"a">, "href"> & {
  /** 移動先の `CarouselItem` の `id` を `#` 付きで指す。 */
  href: string;
};

function scrollToSlide(event: MouseEvent<HTMLAnchorElement>, href: string) {
  const target = document.getElementById(slideIdOf(href));
  const content = target?.closest(CAROUSEL_CONTENT_SLOT);

  if (!target || !content) {
    return;
  }

  event.preventDefault();
  alignSlideToStart(content, target);
}

function handleSlideClick(href: string, onClick?: MouseEventHandler<HTMLAnchorElement>) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    scrollToSlide(event, href);
  };
}

const CAROUSEL_STEP_CLASS =
  "-translate-y-1/2 absolute top-1/2 inline-flex size-9 items-center justify-center rounded-full border border-border/70 bg-background/70 text-foreground transition-colors after:absolute after:-inset-4.5 after:content-[''] hover:border-border hover:bg-background focus-visible:border-border focus-visible:bg-background focus-visible:outline-2 focus-visible:outline-active focus-visible:shadow-glow-primary focus-visible:outline-offset-2";

/**
 * 一つ前の slide へ送る、slide の左端に重なる操作。
 *
 * @remarks
 * 送り先を `CarouselContent` の横スクロールだけで表すため hydration が必要な client island であり、
 * Server Component からは直接 render できない。`Carousel` と slide の中身は Server Component の
 * ままで、この操作だけを分けている。
 *
 * markup は `href` を持つ link のままなので、hydration 前でも押せば送れる。ただし fragment 遷移は
 * carousel を画面内へ引き寄せるためにページごとスクロールさせ、履歴も 1 件積む。hydration 後は
 * 既定動作を止めて `CarouselContent` だけを送るため、ページも履歴も URL も動かない。
 *
 * 置いた `CarouselItem` の中でだけ押せるため、現在位置を追わなくても行き先が決まる。`href` には
 * 一つ前の slide の `id` を渡す。**先頭の slide では要素ごと置かない。** 行き先のない操作を無効な
 * 見た目で残すより、送れる向きだけを見せるほうが誤解が少ない。
 *
 * 記号だけを描くため、アクセシブルな名前は `aria-label` が担う。省略時は「前へ」になる。
 *
 * **slide の中身より後ろに置く。** 位置指定要素は DOM の順で重なるため、`position` を持つ中身より
 * 前に置くと覆われて押せない。
 *
 * 押しミスを防ぐため、当たり判定は見た目の円より一回り広い。円の半径ぶんだけ外周へ透明な領域を
 * 足しており、円の縁を外しても押せる。この領域は slide の内容に重なるので、**slide の中に link や
 * button を置く場合は円の周囲を空ける。** 重なった操作は押せなくなる。
 *
 * 内容を隠しすぎないよう、面と枠は半透明で置き、hover と focus で不透明にする。**薄めるのは面と
 * 枠だけで、記号は透かさない。** 背後に来る画像は選べないため、記号まで薄めると絵柄しだいで
 * contrast が落ちる。touch には hover がなく半透明のまま操作するので、面を今より薄くしない。
 *
 * slide ごとに繰り返されるので、枚数が多いと tab 順に同じ操作が並ぶ。`CarouselNav` で keyboard
 * からの送り先を用意している場合は `tabIndex={-1}` を渡して外す。
 *
 * @param props - native `a` 属性。`href` は必須。
 * @see Storybook `Container/Carousel`
 */
export function CarouselPrevious({
  "aria-label": ariaLabel = "前へ",
  className,
  href,
  onClick,
  ...props
}: CarouselNavigationProps) {
  return (
    <a
      aria-label={ariaLabel}
      className={cn(CAROUSEL_STEP_CLASS, "left-2", className)}
      data-slot="carousel-previous"
      href={href}
      onClick={handleSlideClick(href, onClick)}
      {...props}
    >
      <ChevronLeftIcon aria-hidden="true" className="size-4" />
    </a>
  );
}

/**
 * 一つ次の slide へ送る、slide の右端に重なる操作。
 *
 * @remarks
 * hydration の要否、hydration 前後の挙動の差、当たり判定の広さ、半透明の扱い、tab 順の扱いは
 * {@link CarouselPrevious} と同じである。`href` には一つ次の slide の `id` を渡す。
 * **末尾の slide では要素ごと置かない。**
 *
 * 記号だけを描くため、アクセシブルな名前は `aria-label` が担う。省略時は「次へ」になる。
 *
 * @param props - native `a` 属性。`href` は必須。
 * @see Storybook `Container/Carousel`
 */
export function CarouselNext({
  "aria-label": ariaLabel = "次へ",
  className,
  href,
  onClick,
  ...props
}: CarouselNavigationProps) {
  return (
    <a
      aria-label={ariaLabel}
      className={cn(CAROUSEL_STEP_CLASS, "right-2", className)}
      data-slot="carousel-next"
      href={href}
      onClick={handleSlideClick(href, onClick)}
      {...props}
    >
      <ChevronRightIcon aria-hidden="true" className="size-4" />
    </a>
  );
}

/**
 * 一枚の slide を指す link。
 *
 * @remarks
 * hydration の要否と hydration 前後の挙動の差は {@link CarouselPrevious} と同じである。
 * `href` には移動先の slide の `id` を渡す。
 *
 * {@link CarouselThumbnails} の中に置くと、表示中の slide を指すものへ `aria-current="true"` が付き、
 * 文字色と枠で現在地が分かる。{@link CarouselNav} の中では現在地を持たず、印も付かない。
 *
 * 現在地の枠は border で描く。要素の外側へ描く `ring` は、一覧が横スクロールする面であるため端の
 * 項目で切り取られ、輪の一部だけが線として残る。透明な枠を常に持たせてあるので、印が付いても
 * 大きさは変わらない。
 *
 * link の文言には `1` のような順序ではなく、移動先が何かを表す短い語を与えるとよい。**中身を画像に
 * する場合は `aria-label` でアクセシブルな名前を与える。** 装飾として `alt=""` の画像だけを置くと、
 * link に名前がなくなる。
 *
 * @param props - native `a` 属性。`href` は必須。
 * @see Storybook `Container/Carousel`
 */
export function CarouselLink({ className, href, onClick, ...props }: CarouselNavigationProps) {
  const isCurrent = useContext(CarouselCurrentContext) === href;

  return (
    <li className="flex" data-slot="carousel-nav-item">
      <a
        aria-current={isCurrent ? "true" : undefined}
        className={cn(
          "inline-flex items-center rounded-md border-2 border-transparent px-3 py-1 font-emphasis text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-active focus-visible:shadow-glow-primary focus-visible:outline-offset-2 aria-[current=true]:border-foreground aria-[current=true]:text-foreground",
          className,
        )}
        data-slot="carousel-link"
        href={href}
        onClick={handleSlideClick(href, onClick)}
        {...props}
      />
    </li>
  );
}

/** {@link CarouselThumbnails} の props。 */
export type CarouselThumbnailsProps = ComponentProps<"ul"> & {
  /** hydration 前に現在地の印を付けておく slide の `id`。 */
  defaultCurrentId?: string;
};

/**
 * 表示中の slide に追従する、送り先の一覧。
 *
 * @remarks
 * {@link CarouselNav} を内側に組み、そこへ現在地の追従を足したものである。子には
 * {@link CarouselLink} だけを置き、中身は文字でも画像でもよい。画像を置く場合は link へ
 * `aria-label` でアクセシブルな名前を与える。
 *
 * 表示中の slide を観測するため hydration が必要な client island であり、Server Component からは
 * 直接 render できない。子は props として受け渡すだけなので、画像は Server Component のまま
 * 出力される。
 *
 * **{@link Carousel} の中に置く。** 観測先は同じ carousel の最初の {@link CarouselContent} であり、
 * 外に置くと追従しない。押した slide へ送る動作は {@link CarouselLink} が単独で担うため、追従が
 * 要らない一覧は {@link CarouselNav} のままでよい。
 *
 * 現在地が変わると、その link が一覧からはみ出している場合にだけ**この一覧だけ**を横へ送る。
 * ページのスクロール位置は動かさない。**追従して送るのは横方向だけである。** `className` で縦積みの
 * 一覧にした場合、現在地の印は移るが一覧自体は動かない。
 *
 * 位置と余白は `className` で決める。サムネイル同士の間隔はこの component の `gap-*`、
 * {@link Carousel} との間隔は {@link Carousel} の `gap-*`、main との上下左右の並びは
 * {@link Carousel} の `flex-*` が決める。専用の props は持たない。
 *
 * 意味論は APG の tabbed carousel（`tablist` / `tab` / `tabpanel`）にしない。あれは panel を
 * 出し分ける前提であり、slide がすべて存在してスクロールで見せるこの形には合わない。ページ内
 * link の集合のまま `aria-current` で現在地を示す。
 *
 * 何の一覧かを示す `aria-label` を必ず与える。hydration 前は `defaultCurrentId` を指定した場合
 * だけ印が付く。
 *
 * @param props - native `ul` 属性と `defaultCurrentId`。
 * @see Storybook `Container/Carousel`
 */
export function CarouselThumbnails({
  children,
  className,
  defaultCurrentId,
  ...props
}: CarouselThumbnailsProps) {
  const [strip, setStrip] = useState<HTMLUListElement | null>(null);
  const [currentHref, setCurrentHref] = useState<string | null>(
    defaultCurrentId === undefined ? null : `#${defaultCurrentId}`,
  );

  useEffect(() => {
    const content = strip?.closest('[data-slot="carousel"]')?.querySelector(CAROUSEL_CONTENT_SLOT);
    const slides =
      content === null || content === undefined
        ? []
        : [...content.querySelectorAll(CAROUSEL_ITEM_SLOT)];

    if (slides.length === 0) {
      return;
    }

    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target, entry.intersectionRatio);
        }

        const mostVisible = slides.reduce((best, slide) =>
          (ratios.get(slide) ?? 0) > (ratios.get(best) ?? 0) ? slide : best,
        );

        setCurrentHref(`#${mostVisible.id}`);
      },
      { root: content, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const slide of slides) {
      observer.observe(slide);
    }

    return () => observer.disconnect();
  }, [strip]);

  useEffect(() => {
    if (strip === null || currentHref === null) {
      return;
    }

    const current = [...strip.querySelectorAll('[data-slot="carousel-link"]')].find(
      (link) => link.getAttribute("href") === currentHref,
    );

    if (current !== undefined) {
      keepVisible(strip, current);
    }
  }, [currentHref, strip]);

  return (
    <CarouselCurrentContext.Provider value={currentHref}>
      <CarouselNav
        className={cn("justify-start overflow-x-auto overscroll-x-contain", className)}
        ref={setStrip}
        {...props}
      >
        {children}
      </CarouselNav>
    </CarouselCurrentContext.Provider>
  );
}

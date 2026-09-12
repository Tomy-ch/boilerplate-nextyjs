import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

/**
 * 複数の内容を横方向へ順に閲覧する、SSR first の carousel。
 *
 * @remarks
 * 送りは CSS Scroll Snap と browser 標準のスクロールで成り立つため、この component 自身は
 * client runtime を必要としない。子には {@link CarouselContent} を一つ置き、必要なら
 * {@link CarouselNav} を続ける。
 *
 * touch のスワイプと trackpad の横スクロールは browser のスクロールとして最初から効く。pointer
 * だけで送る手段が要る場合は、slide の左右端へ `CarouselPrevious` / `CarouselNext` を重ねる。
 * この二つと `CarouselLink` だけが client island で、slide の中身は Server Component のまま
 * 出力される。掴んで引っ張る drag は client state を要するため持たない。
 *
 * `role="region"` と `aria-roledescription="carousel"` を付けて、順に閲覧する集合であることを
 * 支援技術へ伝える。`section` が region になるのは名前を持つときだけなので、役割は明示している。
 * **`aria-label` か `aria-labelledby` を必ず与える**。名前のない landmark へ入っても、何の領域なのか
 * 判らない。
 *
 * 自動送り・drag・無限ループは持たない。再生 timer や pointer の追跡を要し、送りの機構を client へ
 * 出すという切り分けを超えるためである。表示中の slide に追従する送り先の一覧が要る場合は
 * `CarouselThumbnails` を使う。
 *
 * @example
 * ```tsx
 * <Carousel aria-label="画像">
 *   <CarouselContent>
 *     <CarouselItem aria-label="1 / 2" id={`${slideId}-1`}>
 *       <MediaImage alt="正面" src={frontUrl} />
 *       <CarouselNext href={`#${slideId}-2`} />
 *     </CarouselItem>
 *     <CarouselItem aria-label="2 / 2" id={`${slideId}-2`}>
 *       <MediaImage alt="背面" src={backUrl} />
 *       <CarouselPrevious href={`#${slideId}-1`} />
 *     </CarouselItem>
 *   </CarouselContent>
 *   <CarouselNav aria-label="画像の送り">
 *     <CarouselLink href={`#${slideId}-1`}>正面</CarouselLink>
 *     <CarouselLink href={`#${slideId}-2`}>背面</CarouselLink>
 *   </CarouselNav>
 * </Carousel>
 * ```
 *
 * @see Storybook `Container/Carousel`
 */
export function Carousel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      aria-roledescription="carousel"
      className={cn("flex flex-col gap-3", className)}
      data-slot="carousel"
      role="region"
      {...props}
    />
  );
}

/**
 * slide を並べ、横方向のスクロールと吸着を担う領域。
 *
 * @remarks
 * `scroll-snap-type` で slide の先頭へ吸着するため、途中で止まった中途半端な位置が残らない。
 * 送り幅は slide 側の `basis-*` が決め、この領域は幅を持たない。
 *
 * スクロールできる領域は keyboard だけで操作する利用者も到達できる必要があるため、`tabIndex` を
 * `0` にしている。focus した状態の矢印キー送りは browser が担う。slide の中身が focus 可能な要素
 * だけで構成される場合は `tabIndex={-1}` を渡して外す。
 *
 * スクロールは親へ連鎖させない。横送りの端に達したあと画面全体が動くと、どちらを操作しているのか
 * 判らなくなるためである。
 *
 * **`scroll-behavior: smooth` を与えない。** 滑らかな送りを指定した領域では、Chromium が fragment
 * 遷移でのスクロールを行わない。`CarouselPrevious` / `CarouselNext` / `CarouselLink` は hydration
 * 前を fragment 遷移で凌ぐため、指定すると hydration が済むまで何も動かなくなる。
 *
 * @see Storybook `Container/Carousel`
 */
export function CarouselContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-active focus-visible:shadow-glow-primary focus-visible:outline-offset-2",
        className,
      )}
      data-slot="carousel-content"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: スクロール可能な領域は非対話でも focus 可能にする必要がある。外すと keyboard だけでは送れず WCAG 2.1.1 に反する
      tabIndex={0}
      {...props}
    />
  );
}

/**
 * carousel の一枚ぶんの内容。
 *
 * @remarks
 * `role="group"` と `aria-roledescription="slide"` を持ち、集合の一枚であることを伝える。
 * **`aria-label` に `1 / 4` のような位置を必ず与える**。carousel は視界に入る枚数が限られるため、
 * 名前がないと全体のどこを読んでいるのか判らない。
 *
 * 既定は領域いっぱいの一枚送りで、`flex-basis` を `className` へ与えると複数枚を並べたまま送れる。
 * {@link CarouselContent} が slide の間に隙間を空けるため、割り切った比率をそのまま与えると隙間の
 * ぶんだけ次の slide がはみ出す。n 枚をちょうど収めるには、比率から隙間の合計を按分して差し引いた
 * 値を渡す（2 枚なら `calc(50% - 0.5rem)`）。
 *
 * {@link CarouselNav} から `href` で指す場合、および `CarouselPrevious` /
 * `CarouselNext` を隣の slide から指す場合は `id` を与える。この二つは slide の左右端へ
 * 重ねて配置されるため、子として置く。
 *
 * **送る操作は中身より後ろに置く。** 位置指定要素は DOM の順で重なるため、`position` を持つ中身
 * （`MediaImage` など）より前に置くと、その中身に覆われて押せない。段階値を持ち出さずに済むよう、
 * 重なりは順序で決める。
 *
 * @see Storybook `Container/Carousel`
 */
export function CarouselItem({ className, ...props }: ComponentProps<"div">) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset は legend を伴う form control の集合を表す。ここは carousel の一枚を束ねるだけであり、意味論は role="group" が正しい
    <div
      aria-roledescription="slide"
      className={cn("relative min-w-0 shrink-0 grow-0 basis-full snap-start", className)}
      data-slot="carousel-item"
      role="group"
      {...props}
    />
  );
}

/**
 * 任意の slide へ移動する link を並べる領域。
 *
 * @remarks
 * scrollbar と keyboard だけでは送り先を選べないため、目的の slide を直接指す導線を添える。
 * 子には `CarouselLink` だけを置く。
 *
 * 何の送りかを示す `aria-label` を必ず与える。同じ画面に carousel が複数あるとき、link の集合が
 * どちらのものか名前でしか区別できない。
 *
 * @see Storybook `Container/Carousel`
 */
export function CarouselNav({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-row items-center justify-center gap-1", className)}
      data-slot="carousel-nav"
      {...props}
    />
  );
}

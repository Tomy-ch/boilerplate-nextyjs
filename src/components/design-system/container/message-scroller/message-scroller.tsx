"use client";

import {
  type ComponentProps,
  createContext,
  type MouseEvent,
  type Ref,
  type UIEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/components/cn";
import { ArrowDownIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import { BUTTON_SIZE, BUTTON_VARIANT } from "../../action/button/button.definition";

/** 末尾から何 px までを「末尾にいる」とみなすか。 */
const DEFAULT_SCROLL_EDGE_THRESHOLD = 8;

/** scroll 位置の比較で無視する誤差。小数の scrollTop が上方向の操作に化けるのを防ぐ。 */
const SCROLL_POSITION_EPSILON = 0.5;

type MessageScrollerContextValue = {
  atEnd: boolean;
  scrollToEnd: (behavior?: ScrollBehavior) => void;
  setContentElement: (element: HTMLElement | null) => void;
  setViewportElement: (element: HTMLElement | null) => void;
  syncAfterScroll: (viewport: HTMLElement) => void;
};

/** 呼び出し元が渡した ref へ、内部で保持する要素を引き渡す。 */
function assignRef<TElement extends HTMLElement>(
  ref: Ref<TElement> | undefined,
  element: TElement | null,
): void {
  if (typeof ref === "function") {
    ref(element);
    return;
  }

  if (ref) {
    ref.current = element;
  }
}

const MessageScrollerContext = createContext<MessageScrollerContextValue | null>(null);

function useMessageScrollerContext(part: string): MessageScrollerContextValue {
  const context = useContext(MessageScrollerContext);

  if (context === null) {
    throw new Error(`${part} は MessageScroller の中で使ってください。`);
  }

  return context;
}

/** {@link MessageScroller} の props。 */
export type MessageScrollerProps = ComponentProps<"div"> & {
  /** 末尾にいる間、内容が増えたら末尾へ追従するか。 */
  autoFollow?: boolean;
  /** 末尾から何 px までを「末尾にいる」とみなすか。 */
  scrollEdgeThreshold?: number;
};

/**
 * 増え続ける一覧の scroll 位置を扱う client island の root。
 *
 * @remarks
 * 末尾にいる間だけ新着へ追従し、利用者が上へ動かしたら追従をやめる。scroll 位置の観測と
 * 要素の寸法変化の検出に browser API を使うため hydration が必要で、Server Component から
 * 直接 render できない。
 *
 * 追従を外す条件は「利用者が上へ動かしたこと」だけである。内容が増えて末尾から離れた状態も
 * 見かけ上は同じだが、それで追従を外すと新着のたびに追従が止まる。
 *
 * 一覧の中身・取得・並び順は持たない。1 件ぶんの表示は `Message` や `Bubble` を子として組む。
 * 局所スクロールだけが必要で追従が要らない場合は、client runtime を持たない `ScrollArea` を使う。
 *
 * 高さは持たないため、`max-h-*` や `h-*` を `className` で与える。与えない場合は内容が伸びる
 * だけでスクロールしない。
 *
 * @example
 * ```tsx
 * <MessageScroller className="h-96">
 *   <MessageScrollerViewport aria-label="やり取り">
 *     <MessageScrollerContent>{items}</MessageScrollerContent>
 *   </MessageScrollerViewport>
 *   <MessageScrollerButton />
 * </MessageScroller>
 * ```
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.autoFollow - 末尾にいる間、内容が増えたら末尾へ追従するか。
 * @param props.scrollEdgeThreshold - 末尾から何 px までを「末尾にいる」とみなすか。
 *
 * @see Storybook `Container/MessageScroller`
 */
export function MessageScroller({
  autoFollow = true,
  className,
  scrollEdgeThreshold = DEFAULT_SCROLL_EDGE_THRESHOLD,
  ...props
}: MessageScrollerProps) {
  const [viewportElement, setViewportElement] = useState<HTMLElement | null>(null);
  const [contentElement, setContentElement] = useState<HTMLElement | null>(null);
  // 要素が付くまで scroll 位置は測れない。初期表示は末尾を映すため、その間も末尾にいるものとして
  // 扱う。false から始めると、末尾へ戻す操作が一瞬現れる。
  const [atEnd, setAtEnd] = useState(true);
  const followingRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  const isAtEdge = useCallback(
    (viewport: HTMLElement) =>
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= scrollEdgeThreshold,
    [scrollEdgeThreshold],
  );

  const scrollToEnd = useCallback(
    /* istanbul ignore next -- 呼び出し元は器の中の 2 箇所だけで、どちらも値を渡す。context は
       外へ出していないため、引数を省いた呼び出しが起こる経路が無い。 */
    (behavior: ScrollBehavior = "auto") => {
      if (!viewportElement) {
        return;
      }

      followingRef.current = true;
      viewportElement.scrollTo({ behavior, top: viewportElement.scrollHeight });
      lastScrollTopRef.current = viewportElement.scrollTop;
      setAtEnd(true);
    },
    [viewportElement],
  );

  const syncAfterScroll = useCallback(
    (viewport: HTMLElement) => {
      const scrolledUp = viewport.scrollTop < lastScrollTopRef.current - SCROLL_POSITION_EPSILON;

      lastScrollTopRef.current = viewport.scrollTop;

      const nextAtEnd = isAtEdge(viewport);

      if (nextAtEnd) {
        followingRef.current = true;
      } else if (scrolledUp) {
        followingRef.current = false;
      }

      setAtEnd(nextAtEnd);
    },
    [isAtEdge],
  );

  useEffect(() => {
    if (!viewportElement) {
      return;
    }

    viewportElement.scrollTo({ behavior: "auto", top: viewportElement.scrollHeight });
    lastScrollTopRef.current = viewportElement.scrollTop;
  }, [viewportElement]);

  useEffect(() => {
    if (!contentElement || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (autoFollow && followingRef.current) {
        scrollToEnd("auto");
        return;
      }

      setAtEnd(viewportElement === null || isAtEdge(viewportElement));
    });

    observer.observe(contentElement);

    return () => {
      observer.disconnect();
    };
  }, [autoFollow, contentElement, isAtEdge, scrollToEnd, viewportElement]);

  const context = useMemo<MessageScrollerContextValue>(
    () => ({ atEnd, scrollToEnd, setContentElement, setViewportElement, syncAfterScroll }),
    [atEnd, scrollToEnd, syncAfterScroll],
  );

  return (
    <MessageScrollerContext.Provider value={context}>
      <div
        className={cn("relative flex min-h-0 flex-col overflow-hidden", className)}
        data-at-end={atEnd}
        data-slot="message-scroller"
        {...props}
      />
    </MessageScrollerContext.Provider>
  );
}

/**
 * 実際にスクロールする枠。
 *
 * @remarks
 * スクロールできる領域は keyboard だけで操作する利用者も到達できる必要があるため `tabIndex` を
 * `0` にし、`region` として公開する。**アクセシブルな名前は呼び出し元が必ず与える**。名前が
 * ないと landmark にならず、focus したときに何の領域へ入ったのか判らない。
 *
 * @param props - native `section` 属性。`aria-label` または `aria-labelledby` は必須。
 *
 * @see Storybook `Container/MessageScroller`
 */
export function MessageScrollerViewport({
  className,
  onScroll,
  ref,
  ...props
}: ComponentProps<"section">) {
  const { setViewportElement, syncAfterScroll } =
    useMessageScrollerContext("MessageScrollerViewport");

  const handleScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      syncAfterScroll(event.currentTarget);
      onScroll?.(event);
    },
    [onScroll, syncAfterScroll],
  );

  const attachRef = useCallback(
    (element: HTMLElement | null) => {
      setViewportElement(element);
      assignRef(ref, element);
    },
    [ref, setViewportElement],
  );

  return (
    <section
      className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain", className)}
      data-slot="message-scroller-viewport"
      onScroll={handleScroll}
      ref={attachRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: スクロール可能な領域は非対話でも focus 可能にする必要がある。外すと keyboard だけではスクロールできず WCAG 2.1.1 に反する
      tabIndex={0}
      {...props}
    />
  );
}

/**
 * 一覧の中身を縦に並べる領域。
 *
 * @remarks
 * `log` として公開し、追加された分だけを読み上げる。既存項目の変更や削除は通知しないため、
 * 内容を書き換える用途には使わない。
 *
 * @param props - native `div` 属性。
 *
 * @see Storybook `Container/MessageScroller`
 */
export function MessageScrollerContent({ className, ref, ...props }: ComponentProps<"div">) {
  const { setContentElement } = useMessageScrollerContext("MessageScrollerContent");

  const attachRef = useCallback(
    (element: HTMLDivElement | null) => {
      setContentElement(element);
      assignRef(ref, element);
    },
    [ref, setContentElement],
  );

  return (
    <div
      aria-relevant="additions"
      className={cn("flex flex-col gap-4", className)}
      data-slot="message-scroller-content"
      ref={attachRef}
      role="log"
      {...props}
    />
  );
}

/** {@link MessageScrollerButton} の props。 */
export type MessageScrollerButtonProps = ComponentProps<typeof Button> & {
  /** scroll の動き方。 */
  behavior?: ScrollBehavior;
};

/**
 * 末尾へ戻すための操作。
 *
 * @remarks
 * 末尾にいる間は render しない。見えないまま focus だけ残ると、keyboard 利用者が行き先の
 * 判らない操作へ到達してしまう。
 *
 * 既定では下向きの装飾アイコンと読み上げ用の文言だけを持つ。文言を変える場合は `children` に
 * 渡す。
 *
 * @param props - {@link Button} の props と、以下の表示用 props。
 * @param props.behavior - scroll の動き方。
 *
 * @see Storybook `Container/MessageScroller`
 */
export function MessageScrollerButton({
  behavior = "smooth",
  children,
  className,
  onClick,
  ...props
}: MessageScrollerButtonProps) {
  const { atEnd, scrollToEnd } = useMessageScrollerContext("MessageScrollerButton");

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      scrollToEnd(behavior);
      onClick?.(event);
    },
    [behavior, onClick, scrollToEnd],
  );

  if (atEnd) {
    return null;
  }

  return (
    <Button
      className={cn("absolute bottom-4 left-1/2 -translate-x-1/2", className)}
      data-slot="message-scroller-button"
      onClick={handleClick}
      size={BUTTON_SIZE.SMALL}
      variant={BUTTON_VARIANT.OUTLINE}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon aria-hidden="true" />
          <span className="sr-only">最新へ移動</span>
        </>
      )}
    </Button>
  );
}

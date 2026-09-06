"use client";

import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/components/cn";
import { GripVerticalIcon } from "@/components/icon";

/** {@link ResizablePanelGroup} の props。 */
export type ResizablePanelGroupProps = ResizablePrimitive.GroupProps;

/** {@link ResizablePanel} の props。 */
export type ResizablePanelProps = ResizablePrimitive.PanelProps;

/** {@link ResizableHandle} の props。 */
export type ResizableHandleProps = ResizablePrimitive.SeparatorProps & {
  /** 掴む場所を示す標識を境界の中央へ置くか。 */
  withHandle?: boolean;
};

/**
 * 境界をドラッグして表示領域の配分を変えられる、pane の集合。
 *
 * @remarks
 * 配分の保持と境界の操作に hydration が必要な client island であり、Server Component からは直接
 * render できない。pane の中身は Server Component のまま `children` として渡せる。
 *
 * **常用する部品ではない。** 表示領域の配分は本来デザインが決めるものであり、利用者に決めさせる
 * のは、どちらをどれだけ見たいかが人と場面で変わる場合に限られる。当てがあるのは、dialog の中で
 * 画像を引き伸ばして見る、といった限られた場面である。一覧と詳細を並べたいだけなら、固定幅の
 * layout か、画面遷移で足りるかを先に検討する。
 *
 * 単一の要素をリサイズできればよい場合はこれを使わない。CSS の `resize` と `overflow` だけで
 * 成立し、client runtime も要らない。この component が要るのは、**複数の pane が総量を分け合う**
 * 場合である。
 *
 * 配分は保存しない。再訪時に前回の配分へ戻す必要がある場合、`onLayoutChange` で受け取った値を
 * 呼び出し元が保存し、`defaultLayout` として渡す。保存先の選択はこの component の責務ではない。
 *
 * 向きは `orientation` が決める。既定は横並びで、`vertical` を渡すと縦に積む。
 *
 * @example
 * ```tsx
 * <ResizablePanelGroup className="h-96" orientation="horizontal">
 *   <ResizablePanel defaultSize="60%" minSize="30%">
 *     <MediaImage alt="正面" src={frontUrl} />
 *   </ResizablePanel>
 *   <ResizableHandle aria-label="画像と説明の区切り" withHandle />
 *   <ResizablePanel minSize="20%">{description}</ResizablePanel>
 * </ResizablePanelGroup>
 * ```
 *
 * @param props - `react-resizable-panels` の Group props。`className` で高さを与える。高さを
 *   与えないと内容の高さのままになり、境界を動かせる幅が生まれない。
 * @see Storybook `Container/Resizable`
 */
export function ResizablePanelGroup({ className, ...props }: ResizablePanelGroupProps) {
  return (
    <ResizablePrimitive.Group
      className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
      data-slot="resizable-panel-group"
      {...props}
    />
  );
}

/**
 * 配分を分け合う pane の一つ。
 *
 * @remarks
 * 大きさは `defaultSize` / `minSize` / `maxSize` で決める。`collapsible` を指定すると
 * `collapsedSize` まで畳める。いずれも `%` や `px` などの単位つきで渡す。
 *
 * 中身のスクロールは持たない。収まらない内容は溢れた分が切られるので、送って読ませる必要が
 * あるものは `ScrollArea` を中に置く。pane 自体をスクロールさせないのは、そこへ keyboard の
 * focus を与える手段が無く、送れない領域ができるためである。
 *
 * @param props - `react-resizable-panels` の Panel props。
 * @see Storybook `Container/Resizable`
 */
export function ResizablePanel({ style, ...props }: ResizablePanelProps) {
  return (
    <ResizablePrimitive.Panel
      data-slot="resizable-panel"
      style={{ overflow: "hidden", ...style }}
      {...props}
    />
  );
}

/**
 * 隣り合う pane の境界。
 *
 * @remarks
 * `separator` として公開され、focus して矢印キーでも動かせる。**`aria-label` で何と何の境界かを
 * 示す。** 省略すると「表示領域の区切り」になるため、境界が複数あるときは必ず与える。同じ名前が
 * 並ぶと、どれを操作しているのか判らない。
 *
 * `withHandle` を指定すると掴む場所の標識を中央へ置く。境界は 1px しかなく、標識が無いと動かせる
 * ことに気付けない。標識そのものは装飾で、操作は境界全体が受ける。
 *
 * @param props - `react-resizable-panels` の Separator props と `withHandle`。`role` と
 *   `tabIndex` は vendor が決めるため渡せない。
 * @see Storybook `Container/Resizable`
 */
export function ResizableHandle({
  "aria-label": ariaLabel = "表示領域の区切り",
  className,
  withHandle = false,
  ...props
}: ResizableHandleProps) {
  return (
    <ResizablePrimitive.Separator
      aria-label={ariaLabel}
      className={cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-2 focus-visible:outline-active focus-visible:shadow-glow-primary focus-visible:outline-offset-2 aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className,
      )}
      data-slot="resizable-handle"
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
          <GripVerticalIcon aria-hidden="true" className="size-2.5" />
        </div>
      ) : null}
    </ResizablePrimitive.Separator>
  );
}

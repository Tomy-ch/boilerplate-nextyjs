import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

/**
 * URL で観点を切り替える、SSR first の tabs。
 *
 * @remarks
 * 選択中の観点を URL が持つため、共有・再読み込み・戻る操作で選択が保たれ、初期表示も Server 側で
 * 確定する。client runtime は必要ない。
 *
 * 観点を URL に置く利点は、server が表示中の観点だけを取得できることにある。観点ごとに取得が
 * 分かれる場合や、パネルの内容が大きい場合はこちらを使う。取得済みの内容を URL に載せずに
 * 出し分けるだけなら、対になる `TabsClient` を使う。
 *
 * **`role="tab"` は使わない。** ARIA の tab パターンは「パネルを client 側で出し分ける」ことを
 * 前提にしており、遷移を伴う link へ当てると、支援技術には切り替わったように伝わったまま実際は
 * ページが変わる、という食い違いが起きる。ここは link の集合であり、`nav` と
 * `aria-current="page"` で現在地を伝える。
 *
 * パネルに相当する要素は持たない。表示内容は遷移先のページがそのまま描画する。
 *
 * @param props - native `nav` 属性。同じ画面に複数の navigation を置くため、`aria-label` で
 *   何の切り替えかを必ず示す。
 *
 * @see Storybook `Navigation/TabsNative`
 */
export function TabsNative({ className, ...props }: ComponentProps<"nav">) {
  return <nav className={cn("w-full", className)} data-slot="tabs-native" {...props} />;
}

/**
 * tab を並べる領域。
 *
 * @remarks
 * 項目数を支援技術へ伝えるため `ul` として並べる。子には `TabsNativeLink` だけを置く。
 *
 * @see Storybook `Navigation/TabsNative`
 */
export function TabsNativeList({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-row items-center gap-1 border-border border-b", className)}
      data-slot="tabs-native-list"
      {...props}
    />
  );
}

/** {@link TabsNativeLink} の props。 */
export type TabsNativeLinkProps = ComponentProps<typeof Link> & {
  /** 現在表示している観点か。 */
  isActive?: boolean;
};

/**
 * 観点へ移動する link。
 *
 * @remarks
 * アプリ内の route 遷移のため `next/link` を使う。`href` は必須で、移動先の URL は呼び出し元が
 * 組み立てる。現在の `searchParams` を引き継ぐ責務は持たないため、絞り込みなどを保ったまま
 * 切り替える場合は既存の query を含めた URL を渡す。
 *
 * 現在の観点には `isActive` を指定する。`aria-current="page"` が付いて支援技術へ現在地が伝わり、
 * 同時に下線と文字色で視覚的にも区別される。色だけに頼らないよう、選択中は下線を併せて示す。
 *
 * @param props - `next/link` の props と `isActive`。
 * @see Storybook `Navigation/TabsNative`
 */
export function TabsNativeLink({ className, isActive = false, ...props }: TabsNativeLinkProps) {
  return (
    <li data-slot="tabs-native-item">
      <Link
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "-mb-px inline-flex items-center border-transparent border-b-2 px-3 py-2 font-emphasis text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-active focus-visible:shadow-glow-primary focus-visible:outline-offset-2",
          isActive && "border-foreground text-foreground",
          className,
        )}
        data-slot="tabs-native-link"
        {...props}
      />
    </li>
  );
}

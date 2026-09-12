import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { ScrollArea } from "../../container/scroll-area/scroll-area";

/** {@link Table} の props。 */
type TableProps = ComponentProps<"table"> & {
  /** スクロールする領域の名前。 */
  label?: string;
  /**
   * スクロールする領域へ与える class 名。
   *
   * @remarks
   * `className` は `table` に付くため、高さの上限（`max-h-*`）はこちらへ渡す。行数で縦に
   * 伸ばしたくない表は、外側をもう 1 枚のスクロール領域で包むのではなくここを使う。包むと
   * スクロール領域が入れ子になり、focus を受け取る領域も二重になる。
   */
  containerClassName?: string;
};

/**
 * 列と行の関係が読み取りに必要な、構造化データを表す表。
 *
 * @remarks
 * 横幅が不足したときに横スクロールする `ScrollArea` で native `table` を包む。表そのものは
 * `TableHeader` / `TableBody` / `TableFooter` を子として合成して組み立てる。
 *
 * 包んだ領域は keyboard だけで横へ送れるよう focus を受け取るため、**`label` で名前を与える**。
 * 名前が無いと、focus したときに何の領域へ入ったのかが判らない。`TableCaption` と同じ語を渡す。
 *
 * 端まで来たらスクロールを外側へ渡す。`ScrollArea` の既定は内側で止める指定だが、表は本文の
 * 途中に置かれるものであり、上端で止まると**表の上に指を置いている間だけページが動かない**
 * 状態になる。内側で止める必要があるのは、独立した面として重なる領域だけである。
 *
 * 取得・並べ替え・filter・pagination・行ごとの操作・業務型は持たない。これらは feature が
 * この部品を合成して実装する。列定義から表の骨格を展開したい場合は `sugar/table` を使う。
 *
 * **layout の目的で使わない。** 情報の関係を表として読む場面に限る。並べるだけでよい内容は
 * `List` や grid の class で組む。
 *
 * @example
 * ```tsx
 * <Table label="直近の申請">
 *   <TableCaption>直近の申請</TableCaption>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead scope="col">申請番号</TableHead>
 *       <TableHead scope="col">金額</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>A-1001</TableCell>
 *       <TableCell>1,200 円</TableCell>
 *     </TableRow>
 *   </TableBody>
 *   <TableFooter>
 *     <TableRow>
 *       <TableHead scope="row">合計</TableHead>
 *       <TableCell>1,200 円</TableCell>
 *     </TableRow>
 *   </TableFooter>
 * </Table>
 * ```
 *
 * @param props - native `table` 属性と `label`。
 * @see Storybook `Display/Table`
 */
function Table({ className, containerClassName, label, ...props }: TableProps) {
  return (
    <ScrollArea
      aria-label={label}
      className={cn("relative w-full overscroll-auto", containerClassName)}
      data-slot="table-container"
      orientation="horizontal"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </ScrollArea>
  );
}

/**
 * 列見出しの行を置く領域。
 *
 * @remarks
 * 子の `TableRow` には `TableCell` ではなく `TableHead` を並べる。列見出しであることは
 * `scope="col"` が伝えるため、呼び出し元が指定する。
 *
 * @see Storybook `Display/Table`
 */
function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

/**
 * 表の主なデータ行を置く領域。
 *
 * @see Storybook `Display/Table`
 */
function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

/**
 * 合計などの補足行を置く領域。
 *
 * @remarks
 * データ行とは別の面として表示される。行の意味を示す見出し cell には `TableHead` を
 * `scope="row"` 付きで置く。
 *
 * @see Storybook `Display/Table`
 */
function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-emphasis [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

/**
 * 表の一行。
 *
 * @remarks
 * 選択状態を面で示す場合は `data-state="selected"` を渡す。選択そのものの管理は持たないため、
 * どの行が選択中かは呼び出し元が決める。
 *
 * @see Storybook `Display/Table`
 */
function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 列または行の見出しを表す cell。
 *
 * @remarks
 * **どちらの見出しかは `scope` でしか伝わらない。** 列見出しには `scope="col"`、行見出しには
 * `scope="row"` を必ず指定する。指定が無いと、支援技術は cell と見出しの対応を読み上げられない。
 *
 * 内容は既定で折り返さない。長い見出しを折り返す場合は `className="whitespace-normal"` を渡す。
 *
 * @see Storybook `Display/Table`
 */
function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-emphasis whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * データを表す cell。
 *
 * @remarks
 * 折り返しは {@link TableHead} と同じで、既定では折り返さない。複数の列や行にまたがる場合は native の `colSpan` / `rowSpan` を渡す。
 *
 * @see Storybook `Display/Table`
 */
function TableCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 表が何を並べたものかを説明する見出し。
 *
 * @remarks
 * 表のアクセシブルな名前になる。視覚的には表の下に表示されるが、支援技術では表の先頭として
 * 読まれるため、`Table` の最初の子として置く。
 *
 * @see Storybook `Display/Table`
 */
function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export type { TableProps };
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };

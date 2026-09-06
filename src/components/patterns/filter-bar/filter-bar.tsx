import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

import { cn } from "@/components/cn";
import { Button } from "@/components/design-system/action/button/button";
import { Badge } from "@/components/design-system/display/badge/badge";
import { BADGE_VARIANT } from "@/components/design-system/display/badge/badge.definition";
import { FilterIcon, XIcon } from "@/components/icon";

/** {@link FilterBar} の props。 */
export type FilterBarProps = ComponentProps<"section"> & {
  /** landmark の名前。同じ画面に絞り込みが複数あるときは区別できる名前にする。 */
  label?: string;
};

/**
 * 一覧の絞り込み操作と、いま効いている条件をまとめる領域。
 *
 * @remarks
 * `section` として landmark を作るため、支援技術から絞り込みへ直接移動できる。検索欄そのものは
 * 持たず、`SearchFieldNative` / `SearchFieldClient` を {@link FilterBarControls} へ合成する。
 *
 * 条件の解釈・URL の組み立て・絞り込みの実行は持たない。呼び出し元が結果として表示する条件と、
 * 解除先の URL または callback を渡す。
 *
 * @param props.label - landmark の名前。
 *
 * @see Storybook `Navigation/FilterBar`
 */
export function FilterBar({ className, label = "絞り込み", ...props }: FilterBarProps) {
  return (
    <section
      aria-label={label}
      className={cn("flex flex-col gap-3", className)}
      data-slot="filter-bar"
      {...props}
    />
  );
}

/**
 * 検索欄と条件を開く操作を並べる行。
 *
 * @remarks
 * 幅の広い要素（検索欄）を先に置くと、狭い画面で操作が折り返しても押しやすい並びになる。
 *
 * @param props - native `div` 属性。
 *
 * @see Storybook `Navigation/FilterBar`
 */
export function FilterBarControls({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      data-slot="filter-bar-controls"
      {...props}
    />
  );
}

/** {@link FilterBarTrigger} の props。 */
export type FilterBarTriggerProps = Omit<ComponentProps<typeof Button>, "asChild"> & {
  /** いま効いている条件の数。0 のときは表示しない。 */
  count?: number;
};

/**
 * 絞り込み条件の入力欄を開く操作。
 *
 * @remarks
 * 開いた先の中身は画面ごとに異なるため持たない。`SheetTrigger` などへ `asChild` を付けて、この
 * component を単一の子として渡す。icon・文言・件数を組み立てる都合でこの component 自身は
 * `asChild` を受け取れない。
 *
 * 条件の数を操作の中に出すのは、閉じている入力欄の中身が見えないためである。数だけでは何が
 * 効いているか分からないので、{@link FilterBarActiveFilters} と併せて使う。
 *
 * @param props.count - いま効いている条件の数。
 *
 * @see Storybook `Navigation/FilterBar`
 */
export function FilterBarTrigger({
  children = "絞り込み",
  count = 0,
  variant = "outline",
  ...props
}: FilterBarTriggerProps) {
  return (
    <Button data-slot="filter-bar-trigger" variant={variant} {...props}>
      <FilterIcon aria-hidden="true" />
      {children}
      {count === 0 ? null : (
        <Badge aria-label={`${count} 件の条件が有効`} variant={BADGE_VARIANT.SECONDARY}>
          {count}
        </Badge>
      )}
    </Button>
  );
}

/** {@link FilterBarSummary} の props。 */
export type FilterBarSummaryProps = ComponentProps<"div"> & {
  /** 絞り込んだ結果の件数。 */
  count: number;
  /** 絞り込む前の総件数。渡すと「全 N 件中」を添える。 */
  total?: number;
  /** すべての条件を解除する導線。 */
  children?: ReactNode;
};

/**
 * 絞り込んだ結果の件数と、条件をすべて解除する導線。
 *
 * @remarks
 * 件数は `aria-live` で伝える。条件を変えた結果が一覧の見た目だけに現れると、画面を見ていない
 * 利用者には何件になったか分からない。URL 遷移で一覧全体が入れ替わる場合は読み上げが重複しない
 * よう、`aria-live` は件数の要素だけに閉じている。
 *
 * @param props.count - 絞り込んだ結果の件数。
 * @param props.total - 絞り込む前の総件数。
 * @param props.children - すべての条件を解除する導線。
 *
 * @see Storybook `Navigation/FilterBar`
 */
export function FilterBarSummary({
  className,
  count,
  total,
  children,
  ...props
}: FilterBarSummaryProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-between gap-2 text-sm", className)}
      data-slot="filter-bar-summary"
      {...props}
    >
      <p aria-live="polite" className="text-muted-foreground">
        {total === undefined ? `${count} 件` : `全 ${total} 件中 ${count} 件`}
      </p>
      {children}
    </div>
  );
}

/** {@link FilterBarActiveFilters} の props。 */
export type FilterBarActiveFiltersProps = ComponentProps<"ul"> & {
  /** 一覧の名前。 */
  label?: string;
};

/**
 * いま効いている条件を並べる一覧。
 *
 * @remarks
 * 条件が無いときも要素を残す。条件を外し切ったときに一覧ごと消えると、支援技術には「何が起きたか」
 * が伝わらないためである。

 * `tabIndex={-1}` は、条件を外したあとの focus の受け皿として使う。押した解除操作は消えるため、
 * focus を置く先が要る。focus は移すが輪は描かない。操作した直後に中身が目に見えて変わるため、輪が足す情報が無く、pointer で操作した人には押した場所と無関係な枠が現れることになる。行き先は要素の名前が伝える。
 *
 * @param props.label - 一覧の名前。
 *
 * @see Storybook `Navigation/FilterBar`
 */
export function FilterBarActiveFilters({
  className,
  label = "適用中の条件",
  ...props
}: FilterBarActiveFiltersProps) {
  return (
    <ul
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-2 outline-hidden", className)}
      data-slot="filter-bar-active-filters"
      tabIndex={-1}
      {...props}
    />
  );
}

/** {@link FilterChip} の props。解除の手段は URL か callback のどちらか一方を渡す。 */
export type FilterChipProps = {
  /** 条件の名前。「状態」「価格帯」など。 */
  label: string;
  /** 条件の値。「公開中」「1,000 円以上」など。 */
  value: string;
  /** この条件だけを外した URL。URL に条件を載せる一覧で使う。 */
  removeHref?: string;
  /** この条件だけを外す操作。client 側で条件を持つ一覧で使う。 */
  onRemove?: () => void;
};

/**
 * いま効いている条件 1 件と、その解除操作。
 *
 * @remarks
 * `removeHref` と `onRemove` はどちらか一方を渡す。URL に条件を載せる一覧では link
 * （`removeHref`）にすると、条件を外した状態が履歴と共有可能な URL に残る。client 側で条件を
 * 持つ一覧では `onRemove` を渡す。どちらも渡さない場合、条件は表示だけになる。
 *
 * 解除操作のアクセシブルな名前には条件名と値を含める。「×」だけでは、複数並んだときにどれを外す
 * のか操作の一覧からは判別できない。
 *
 * @param props.label - 条件の名前。
 * @param props.value - 条件の値。
 *
 * @see Storybook `Navigation/FilterBar`
 */
export function FilterChip({ label, value, removeHref, onRemove }: FilterChipProps) {
  const removeLabel = `${label}: ${value} を解除`;

  return (
    <li data-slot="filter-chip">
      <Badge className="gap-1 py-0.5 pr-0.5 pl-2.5" variant={BADGE_VARIANT.SECONDARY}>
        <span>
          {label}: {value}
        </span>
        <FilterChipRemove href={removeHref} label={removeLabel} onRemove={onRemove} />
      </Badge>
    </li>
  );
}

/**
 * 解除操作の見た目。
 *
 * icon は badge の文字より大きくしないが、操作としては 24px 角を確保する。文字に合わせて
 * 縮めると、指で押す対象として小さすぎる。
 */
const REMOVE_CONTROL_CLASS =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-active focus-visible:shadow-glow-primary [&>svg]:size-3";

/**
 * 外した条件の解除操作は消えるため、focus を一覧へ移してから外す。捕捉段階で受け取るのは、
 * 呼び出し元の `onRemove` が要素を外すより先に focus を移す必要があるためである。
 *
 * 移さないと focus が document へ落ち、keyboard 利用者は残りの条件へ辿り直すことになる。
 */
function focusActiveFilters(event: MouseEvent<HTMLButtonElement>) {
  const list = event.currentTarget.closest("[data-slot='filter-bar-active-filters']");

  if (list instanceof HTMLElement) list.focus();
}

/** URL で外すか、その場で外すか、外せないかを 1 か所で決める。 */
function FilterChipRemove({
  href,
  label,
  onRemove,
}: {
  href?: string;
  label: string;
  onRemove?: () => void;
}) {
  if (href !== undefined) {
    return (
      <Link aria-label={label} className={REMOVE_CONTROL_CLASS} href={href}>
        <XIcon aria-hidden="true" />
      </Link>
    );
  }

  if (onRemove !== undefined) {
    return (
      <button
        aria-label={label}
        className={REMOVE_CONTROL_CLASS}
        onClick={onRemove}
        onClickCapture={focusActiveFilters}
        type="button"
      >
        <XIcon aria-hidden="true" />
      </button>
    );
  }

  return null;
}

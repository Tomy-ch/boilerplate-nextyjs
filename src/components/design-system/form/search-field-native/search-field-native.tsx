import type { ComponentProps } from "react";

import { SearchIcon } from "@/components/icon";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../input-group/input-group";
import {
  INPUT_GROUP_ADDON_ALIGN,
  INPUT_GROUP_BUTTON_SIZE,
} from "../input-group/input-group.definition";

/** {@link SearchFieldNative} の props。 */
export type SearchFieldNativeProps = Omit<
  ComponentProps<"form">,
  "children" | "method" | "role"
> & {
  /**
   * 検索入力のアクセシブルな名前。
   *
   * 視覚的なラベルは持たないため、何を検索する欄なのかはこの値だけが伝える。`placeholder` は
   * 入力を始めると消えるため、名前の代わりにはならない。
   */
  label: string;
  /** 検索語を載せる query の名前。 */
  name?: string;
  /** 初期表示する検索語。現在の検索条件を反映する場合に、呼び出し元が `searchParams` から渡す。 */
  defaultValue?: string;
  /** 入力例を示す補助文。 */
  placeholder?: string;
  /**
   * 送信時に引き継ぐ query。hidden input として復元される。
   *
   * GET の form は送信時に URL の query をすべて捨てるため、並び順や絞り込みを保ちたい場合は
   * ここへ渡す。ページ番号のように検索し直すと意味を失う query は、渡さないことで初期化する。
   *
   * 同じキーが複数の値を取る query は、値を並びで渡す。query 文字列は 1 つのキーに 1 つの値と
   * 決まっていないため、map で表すと表せない条件が出る。
   */
  hiddenParams?: Readonly<Record<string, string | readonly string[]>>;
  /** 送信ボタンのラベル。 */
  submitLabel?: string;
};

/**
 * キーワード検索の入力欄を、native の GET form として組み立てる Server Component。
 *
 * @remarks
 * hydration を必要とせず、Server Component から直接 render できる。JavaScript が動かない環境でも
 * 送信でき、結果は URL に載るため共有・履歴・戻る操作がそのまま機能する。打鍵ごとに結果を
 * 反映したい場合だけ `SearchFieldClient` を選ぶ。
 *
 * 検索の実行、結果の取得、URL の組み立ては持たない。送信先は `action`、引き継ぐ query は
 * `hiddenParams` として呼び出し元が渡す。この分担は `Pagination` と同じで、`components` は
 * URL を解釈しない。
 *
 * HTML の `search` 要素で囲むため、支援技術の landmark 一覧から到達できる。同じ画面に検索欄を
 * 複数置く場合は、`aria-label` で landmark を区別する。
 *
 * @example
 * ```tsx
 * <SearchFieldNative
 *   action="/items"
 *   defaultValue={searchParams.q}
 *   hiddenParams={{ sort: searchParams.sort }}
 *   label="項目を検索"
 * />
 * ```
 *
 * @param props - native `form` 属性と、上記の表示用 props。`method` と `role` は固定のため渡せない。
 * @see Storybook `Form/SearchFieldNative`
 */
export function SearchFieldNative({
  className,
  defaultValue,
  hiddenParams,
  label,
  name = "q",
  placeholder,
  submitLabel = "検索",
  ...props
}: SearchFieldNativeProps) {
  return (
    <search className={className} data-slot="search-field">
      <form data-slot="search-field-form" method="get" {...props}>
        {Object.entries(hiddenParams ?? {}).flatMap(([key, value]) =>
          (typeof value === "string" ? [value] : value).map((single) => (
            <input key={`${key}:${single}`} name={key} type="hidden" value={single} />
          )),
        )}
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={label}
            defaultValue={defaultValue}
            data-slot="search-field-input"
            name={name}
            placeholder={placeholder}
            type="search"
          />
          <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
            <InputGroupButton
              data-slot="search-field-submit"
              size={INPUT_GROUP_BUTTON_SIZE.EXTRA_SMALL}
              type="submit"
            >
              {submitLabel}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </search>
  );
}

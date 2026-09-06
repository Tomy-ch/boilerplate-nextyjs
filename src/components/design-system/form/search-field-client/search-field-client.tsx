"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { SearchIcon, XIcon } from "@/components/icon";

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
import { SEARCH_FIELD_COMMIT, type SearchFieldCommit } from "./search-field-client.definition";

/**
 * 入力が止まってから {@link SearchFieldClient} が通知するまでの既定の待ち時間（ミリ秒）。
 *
 * @see Storybook `Form/SearchFieldClient`
 */
export const SEARCH_FIELD_DEBOUNCE_MS = 300;

/** {@link SearchFieldClient} の props。 */
export type SearchFieldClientProps = {
  /**
   * 検索入力のアクセシブルな名前。
   *
   * 視覚的なラベルは持たないため、何を検索する欄なのかはこの値だけが伝える。`placeholder` は
   * 入力を始めると消えるため、名前の代わりにはならない。
   */
  label: string;
  /**
   * 検索語が確定したときに呼ばれる。
   *
   * 引数は現在の検索語で、消去された場合は空文字列になる。いつ確定と見なすかは `commit` が
   * 決める。URL の更新、取得、遷移はここで呼び出し元が行う。
   */
  onSearch: (value: string) => void;
  /**
   * 確定と見なす契機。既定は打鍵が止まった時点。
   *
   * ほかの条件と一緒にまとめて確定する画面では `submit` を選ぶ。打鍵のたびに確定すると、
   * 検索語だけが先に効いた中途半端な条件で結果が入れ替わる。
   */
  commit?: SearchFieldCommit;
  /**
   * 現在の検索語。
   *
   * 渡すと制御 component として動き、入力の保持は呼び出し元の責務になる。ほかの条件と同じ
   * 場所に検索語を持つ画面で使う。渡さなければ内部で保持する。
   */
  value?: string;
  /** 打鍵のたびに呼ばれる。制御 component として使う場合に渡す。 */
  onValueChange?: (value: string) => void;
  /** 初期表示する検索語。非制御の場合に使う。 */
  defaultValue?: string;
  /** 入力例を示す補助文。 */
  placeholder?: string;
  /** 入力が止まってから `onSearch` を呼ぶまでの待ち時間（ミリ秒）。`commit` が `typing` のときだけ効く。 */
  debounceMs?: number;
  /** 消去ボタンのアクセシブルな名前。 */
  clearLabel?: string;
  /** 送信ボタンのラベル。`commit` が `submit` のときだけ出る。 */
  submitLabel?: string;
  /**
   * 送信を押せなくするか。`commit` が `submit` のときだけ効く。
   *
   * 押しても結果が変わらないと呼び出し元が判っている場合に渡す。部品の側は「空かどうか」で
   * 判断しない —— 空の送信が意味を持つか（効いている検索語を外す）は画面が決める。
   */
  submitDisabled?: boolean;
  /** 追加の class。 */
  className?: string;
};

/**
 * キーワード検索の入力を保持する client island。
 *
 * @remarks
 * 入力の保持を browser 側で行うため hydration が必要で、Server Component からは直接 render
 * できない。JavaScript が無くても送信できる形が要る場合は `SearchFieldNative` を選ぶ。
 *
 * **いつ確定するかは `commit` が決める。** 既定は打鍵が止まった時点で、検索語だけで絞り込みが
 * 完結し結果がその場に見えている画面向け。ほかの条件と一緒にまとめて確定する画面は `submit` を
 * 選び、送信の操作でだけ通知させる。
 *
 * **`submit` でも form は使わない。** form にすると、hydration が終わる前に押されたとき browser の
 * 既定の送信が走り、いま効いている条件を伴わないまま現在の URL へ遷移する —— 押した結果として
 * 条件が消える。form を持たなければ、hydration 前の操作は何も起こさずに済む。
 *
 * 検索の実行、結果の取得、URL の組み立ては持たない。確定したら `onSearch` を呼ぶだけで、router の
 * 操作も行わない。この分担は `Pagination` と同じで、`components` は URL を解釈しない。呼び出し元は
 * 受け取った検索語を `searchParams` へ載せ、結果は Server Component で描画する。結果まで client 側で
 * 取得すると、共有・履歴・戻る操作が URL と一致しなくなる。
 *
 * `commit` が `typing` のとき、`onSearch` は入力が止まってから呼ばれる。参照が変わるたびに待ち時間が
 * 測り直されるため、呼び出し元は `useCallback` などで安定した関数を渡す。
 *
 * `value` を渡すと制御 component として動く。ほかの条件と同じ場所に検索語を持つ画面では、消去や
 * 一括解除で外から値が変わるため、内部に持つと画面の条件と入力欄が食い違う。
 *
 * HTML の `search` 要素で囲むため、支援技術の landmark 一覧から到達できる。同じ画面に検索欄を
 * 複数置く場合は、`aria-label` で landmark を区別する。
 *
 * @example
 * ```tsx
 * // 打鍵に追従する（既定）
 * <SearchFieldClient label="項目を検索" onSearch={handleSearch} />
 *
 * // ほかの条件と一緒に確定する
 * <SearchFieldClient
 *   commit={SEARCH_FIELD_COMMIT.SUBMIT}
 *   label="項目を検索"
 *   onSearch={handleSearch}
 *   onValueChange={setKeyword}
 *   submitDisabled={keyword === "" && applied === ""}
 *   value={keyword}
 * />
 * ```
 *
 * @see Storybook `Form/SearchFieldClient`
 */
export function SearchFieldClient({
  className,
  clearLabel = "検索語を消去",
  commit = SEARCH_FIELD_COMMIT.TYPING,
  debounceMs = SEARCH_FIELD_DEBOUNCE_MS,
  defaultValue = "",
  label,
  onSearch,
  onValueChange,
  placeholder,
  submitDisabled = false,
  submitLabel = "検索",
  value: controlled,
}: SearchFieldClientProps) {
  const [internal, setInternal] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);
  const value = controlled ?? internal;

  const change = useCallback(
    (next: string) => {
      if (controlled === undefined) {
        setInternal(next);
      }

      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  useEffect(() => {
    if (commit !== SEARCH_FIELD_COMMIT.TYPING) {
      return;
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => onSearch(value), debounceMs);

    return () => clearTimeout(timer);
  }, [commit, debounceMs, onSearch, value]);

  const clear = useCallback(() => {
    change("");
    inputRef.current?.focus();
  }, [change]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => change(event.target.value),
    [change],
  );

  const commitValue = useCallback(() => {
    onSearch(value);
  }, [onSearch, value]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        commitValue();
      }
    },
    [commitValue],
  );

  const field = (
    <InputGroup>
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={label}
        data-slot="search-field-input"
        onChange={handleChange}
        onKeyDown={commit === SEARCH_FIELD_COMMIT.SUBMIT ? handleKeyDown : undefined}
        placeholder={placeholder}
        ref={inputRef}
        type="search"
        value={value}
      />
      {value ? (
        <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
          <InputGroupButton
            aria-label={clearLabel}
            data-slot="search-field-clear"
            onClick={clear}
            size={INPUT_GROUP_BUTTON_SIZE.ICON_EXTRA_SMALL}
            type="button"
          >
            <XIcon aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
      {commit === SEARCH_FIELD_COMMIT.SUBMIT ? (
        <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
          <InputGroupButton
            data-slot="search-field-submit"
            disabled={submitDisabled}
            onClick={commitValue}
            size={INPUT_GROUP_BUTTON_SIZE.EXTRA_SMALL}
            type="button"
          >
            {submitLabel}
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );

  return (
    <search className={className} data-slot="search-field">
      {field}
    </search>
  );
}

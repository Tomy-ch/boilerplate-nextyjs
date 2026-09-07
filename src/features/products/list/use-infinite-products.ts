"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { fetchProductListPage, PRODUCT_LIST_MAX_ITEMS } from "@/adapters/client/api/products";
import { useOnVisible } from "@/capabilities/use-on-visible";
import type { LoadMoreState } from "@/components/app-starter/load-more/load-more.definition";
import { appendCursorPage, type CursorPage } from "@/model/pagination";
import type { ProductListItem } from "@/model/product/product";
import {
  COUNT_KEY,
  CURSOR_KEY,
  type ProductListSelection,
  toProductListSearchParams,
} from "../facade/list-url/list-url";
import { PRODUCT_PAGE_SIZE } from "./page-size";

/** 末尾に近づいたと見なす距離。画面に入り切る前に読み始めて、待たせる時間を短くする。 */
const PREFETCH_MARGIN = "400px";

/** 続きの取得が今どこに居るか。終端かどうかは読み込んだページが決めるため含めない。 */
type FetchPhase = "idle" | "loading" | "failed";

/** 読み進めた一覧の状態と、続きを読む手段。 */
export type InfiniteProducts = {
  /** 読み込み済みのすべての商品。 */
  readonly items: readonly ProductListItem[];
  /** 続きの読み込みの状態。読み直す操作は失敗したときだけ載る。 */
  readonly loadMore: LoadMoreState;
  /** 一覧の末尾に置く目印。ここが見えたら続きを読む。 */
  readonly sentinelRef: RefObject<HTMLDivElement | null>;
};

/**
 * 一覧を読み進める。
 *
 * @remarks
 * 使うのがこの一覧だけなので `features` の中へ置いています。
 *
 * 初回ページは受け取るだけで取得しません。取得するのは Server Component であり、この hook が
 * 担うのは 2 ページ目以降だけです。
 *
 * 読み進めた件数を URL へ書き戻します。書き戻さないと、戻る操作も再読み込みも先頭の 1 ページ
 * だけの画面に戻り、読み進めた分がスクロール位置ごと失われます。履歴を積まずに現在の項目を
 * 差し替えるので、戻る操作は一覧より前の画面へ抜けます。
 *
 * @param initial - Server Component が取得した最初のページ
 * @param query - いま効いている検索条件。続きの取得にそのまま渡す
 */
export function useInfiniteProducts(
  initial: CursorPage<ProductListItem>,
  query: ProductListSelection,
): InfiniteProducts {
  const [page, setPage] = useState(initial);
  const [phase, setPhase] = useState<FetchPhase>("idle");
  const abortRef = useRef<AbortController | null>(null);

  const loadMore = useCallback(() => {
    const cursor = page.nextCursor;

    if (cursor === null || phase === "loading") {
      return;
    }

    const controller = new AbortController();

    abortRef.current = controller;
    setPhase("loading");

    const params = toProductListSearchParams(query);

    // 件数を明示する。条件から落としてあるので、渡さないと契約の既定値になり、初回と
    // 2 ページ目以降で 1 度に増える量が変わる。
    params.set(COUNT_KEY, String(PRODUCT_PAGE_SIZE));
    params.set(CURSOR_KEY, cursor);

    fetchProductListPage(params, controller.signal)
      .then((next) => {
        setPage((loaded) => appendCursorPage(loaded, next));
        setPhase("idle");
      })
      .catch(() => {
        // 打ち切りは失敗ではない。条件が変わったか画面を離れたかで、伝える相手がもういない。
        if (!controller.signal.aborted) {
          setPhase("failed");
        }
      });
  }, [page.nextCursor, phase, query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const sentinelRef = useOnVisible(loadMore, {
    enabled: page.nextCursor !== null,
    rootMargin: PREFETCH_MARGIN,
  });

  const loadedCount = page.items.length;

  useEffect(() => {
    const url = new URL(window.location.href);

    url.searchParams.set(COUNT_KEY, String(Math.min(loadedCount, PRODUCT_LIST_MAX_ITEMS)));
    window.history.replaceState(window.history.state, "", url);
  }, [loadedCount]);

  if (page.nextCursor === null) {
    return { items: page.items, loadMore: { status: "exhausted" }, sentinelRef };
  }

  return {
    items: page.items,
    loadMore: phase === "failed" ? { status: "failed", onRetry: loadMore } : { status: phase },
    sentinelRef,
  };
}

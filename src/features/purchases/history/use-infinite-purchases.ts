"use client";

import { useRouter } from "next/navigation";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { fetchPurchaseHistoryPage } from "@/adapters/client/api/purchases";
import { useOnVisible } from "@/capabilities/use-on-visible";
import type { LoadMoreState } from "@/components/app-starter/load-more/load-more.definition";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { appendCursorPage, type CursorPage } from "@/model/pagination";
import type { PurchaseHistoryEntry } from "@/model/purchase/purchase";
import type { TimeWindow } from "@/model/time-window";
import { COUNT_KEY, CURSOR_KEY, WINDOW_AFTER_KEY, WINDOW_BEFORE_KEY } from "./query";

/** 末尾に近づいたと見なす距離。画面に入り切る前に読み始めて、待たせる時間を短くする。 */
const PREFETCH_MARGIN = "400px";

/** 続きの取得が今どこに居るか。終端かどうかは読み込んだページが決めるため含めない。 */
type FetchPhase = "idle" | "loading" | "failed";

/** 読み進めた履歴の状態と、続きを読む手段。 */
export type InfinitePurchases = {
  /** 読み込み済みのすべての購入。 */
  readonly items: readonly PurchaseHistoryEntry[];
  /** 続きの読み込みの状態。読み直す操作は失敗したときだけ載る。 */
  readonly loadMore: LoadMoreState;
  /** 一覧の末尾に置く目印。ここが見えたら続きを読む。 */
  readonly sentinelRef: RefObject<HTMLDivElement | null>;
};

/**
 * 購入履歴を読み進める。
 *
 * @remarks
 * 使うのがこの一覧だけなので `features` の中へ置いています。
 *
 * 初回ページは受け取るだけで取得しません。取得するのは Server Component であり、この hook が
 * 担うのは 2 ページ目以降だけです。
 *
 * **続きの取得にも同じ区間を渡します。** 契約は「ページ送りの間は同じ絞り込み条件を渡すこと」を
 * 前提に keyset の連続性を保証しているため、途中で条件が変わると飛ばされる購入が出ます。区分では
 * なく解いた区間を受け取るのは、「直近 N 日」をページごとに解き直すとその条件が崩れるためです。
 *
 * **資格情報が切れたら、続きの失敗として扱いません。** `router.refresh()` でサーバへ描き直しを
 * 頼み、送り先の判断は route の確定認可へ委ねます。
 *
 * **積み上げを捨てる判断は持ちません。** 別の一覧になったかどうかは置く側が鍵で表し、React が
 * 作り直します。
 *
 * @param initial - Server Component が取得した最初のページ
 * @param window - いま効いている期間の区間。続きの取得にそのまま渡す
 * @param pageSize - 1 度に読み込む件数
 */
export function useInfinitePurchases(
  initial: CursorPage<PurchaseHistoryEntry>,
  window: TimeWindow,
  pageSize: number,
): InfinitePurchases {
  const router = useRouter();
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

    const params = new URLSearchParams();

    params.set(COUNT_KEY, String(pageSize));
    params.set(CURSOR_KEY, cursor);

    if (window.after !== undefined) {
      params.set(WINDOW_AFTER_KEY, window.after);
    }

    if (window.before !== undefined) {
      params.set(WINDOW_BEFORE_KEY, window.before);
    }

    fetchPurchaseHistoryPage(params, controller.signal)
      .then((next) => {
        setPage((loaded) => appendCursorPage(loaded, next));
        setPhase("idle");
      })
      .catch((cause: unknown) => {
        // 打ち切りは失敗ではない。条件が変わったか画面を離れたかで、伝える相手がもういない。
        if (controller.signal.aborted) {
          return;
        }

        if (findAppError(cause)?.kind === ErrorKind.UNAUTHENTICATED) {
          router.refresh();

          return;
        }

        setPhase("failed");
      });
  }, [page.nextCursor, pageSize, phase, router, window]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const sentinelRef = useOnVisible(loadMore, {
    enabled: page.nextCursor !== null,
    rootMargin: PREFETCH_MARGIN,
  });

  if (page.nextCursor === null) {
    return { items: page.items, loadMore: { status: "exhausted" }, sentinelRef };
  }

  return {
    items: page.items,
    loadMore: phase === "failed" ? { status: "failed", onRetry: loadMore } : { status: phase },
    sentinelRef,
  };
}

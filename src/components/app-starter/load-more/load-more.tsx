import type { ReactNode, RefObject } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { Spinner } from "@/components/design-system/status/spinner/spinner";

import type { LoadMoreState } from "./load-more.definition";

/** {@link LoadMore} の props。 */
export type LoadMoreProps = {
  /** 続きの読み込みの状態。 */
  state: LoadMoreState;
  /** 末尾到達を見張る目印を置く先。scroll で読み進める側が渡す。 */
  sentinelRef?: RefObject<HTMLDivElement | null>;
  /** 読み直す操作の名前。既定は「もう一度読み込む」。 */
  retryLabel?: string;
  /** 失敗したことを伝える文。既定は「続きを読み込めませんでした。」。 */
  failureMessage?: string;
  /** 取得中であることを読み上げへ伝える語。既定は「続きを読み込んでいます」。 */
  loadingLabel?: string;
  /**
   * 取得中に、届く分の場所を先に取る骨組み。
   *
   * @remarks
   * 一覧ごとに項目の姿が違うので、何を並べるかは呼び出し元が決めます。
   */
  placeholder?: ReactNode;
};

/**
 * 増分取得の一覧の末尾に置く、続きの読み込みの状態。
 *
 * @remarks
 * **取得を持ちません。** 取得中・失敗・終端という 3 つの見え方を、状態を持たずに描き分けます。
 * 取得と末尾到達の検知は呼び出し元が持ちます。
 *
 * **続きを読む操作は失敗したときだけ出します。** 読み進めている間は末尾に近づくだけで次が
 * 始まるため、同じことをする入口を並べても選ぶ手数が増えるだけです。失敗した後だけは事情が
 * 違い、末尾到達の検知はその場に留まる限り二度と起きないので、操作が唯一の復帰口になります。
 *
 * この形でも scroll 以外の手段が失われないのは、keyboard の scroll も支援技術の読み進めも
 * 表示位置を動かし、末尾到達の検知はそれで発火するためです。動かしても直らない失敗の場面にだけ
 * 操作を置くのは、この性質と表裏です。
 *
 * 終端では何も描きません。読み終えたことは一覧が尽きていることで伝わり、そこに空の枠が残ると
 * まだ続きがあるように読めます。
 *
 * **取得中は届く分の場所を先に取ります。** 追記は一覧の末尾で起きるので、場所を取らないと、
 * この箱がページ 1 枚分そのまま下へ動きます —— 読み進めている人の目の前で起きる大きなずれで、
 * Core Web Vitals の CLS がそれを数えます。骨組みを実寸で並べておくと、届いた項目がそれを
 * 置き換えるだけになり、箱は動きません。
 *
 * **これは lab では鳴りません。** 合成計測は scroll しないので、読み進めて初めて起きるずれは
 * field（RUM）でしか見えません。
 *
 * 前後へ 1 ページずつ動く一覧には
 * [`CursorPagination`](../cursor-pagination/README.md) を使います。同じ cursor 方式でも、
 * こちらは**読み進めて積み増す**一覧のためのものです。
 *
 * @example
 * ```tsx
 * import { LoadMore } from "@/components/app-starter/load-more/load-more";
 *
 * <LoadMore sentinelRef={sentinelRef} state={{ status: "loading" }} />;
 * ```
 *
 * @param props.state - 続きの読み込みの状態。
 * @param props.sentinelRef - 末尾到達を見張る目印を置く先。
 * @param props.retryLabel - 読み直す操作の名前。
 * @param props.failureMessage - 失敗したことを伝える文。
 * @param props.loadingLabel - 取得中であることを読み上げへ伝える語。
 * @param props.placeholder - 取得中に、届く分の場所を先に取る骨組み。
 * @see Storybook `Navigation/LoadMore`
 */
export function LoadMore({
  state,
  sentinelRef,
  placeholder,
  retryLabel = "もう一度読み込む",
  failureMessage = "続きを読み込めませんでした。",
  loadingLabel = "続きを読み込んでいます",
}: LoadMoreProps) {
  if (state.status === "exhausted") {
    return null;
  }

  return (
    <div className="flex min-h-12 flex-col items-center gap-3" ref={sentinelRef}>
      {state.status === "failed" ? (
        <>
          <p className="text-destructive text-sm">{failureMessage}</p>
          <Button onClick={state.onRetry} type="button" variant={BUTTON_VARIANT.OUTLINE}>
            {retryLabel}
          </Button>
        </>
      ) : null}
      {state.status === "loading" ? (
        <>
          <Spinner className="size-6 text-muted-foreground" label={loadingLabel} />
          {placeholder === undefined ? null : <div className="w-full">{placeholder}</div>}
        </>
      ) : null}
    </div>
  );
}

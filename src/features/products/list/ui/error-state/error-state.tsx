"use client";

import { Button } from "@/components/design-system/action/button/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";

/** `ProductListError` の props。 */
export type ProductListErrorProps = {
  /** 表示する文言。境界で正規化済みのものを渡す。 */
  message: string;
  /** サーバログとの突合に使う識別子。 */
  digest?: string;
  /** 再取得を試みる。App Router の error 境界が渡す `reset`。 */
  onRetry: () => void;
};

/**
 * 一覧の取得に失敗したときの表示。
 *
 * @remarks
 * 生のエラーもスタックも出しません。production では Server Component から投げられたエラーの
 * 本文が伏せられ、境界には汎用文言と `digest` だけが渡るためです。原因の特定は `digest` と
 * サーバ側のログの突合で行います。
 */
export function ProductListError({ message, digest, onRetry }: ProductListErrorProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>商品を取得できませんでした</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message}</p>
        {digest === undefined ? null : (
          <p className="text-xs">
            問い合わせ番号: <code>{digest}</code>
          </p>
        )}
        <Button variant="outline" size="sm" onClick={onRetry}>
          再試行
        </Button>
      </AlertDescription>
    </Alert>
  );
}

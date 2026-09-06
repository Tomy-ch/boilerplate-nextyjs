import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/components/cn";
import { Button } from "@/components/design-system/action/button/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/design-system/display/table/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";
import { Spinner } from "@/components/design-system/status/spinner/spinner";
import { DownloadIcon } from "@/components/icon";

/** {@link ImportSummary} の props。 */
export type ImportSummaryProps = ComponentProps<"div"> & {
  /** 取り込もうとした件数。 */
  total: number;
  /** 取り込めた件数。 */
  succeeded: number;
  /** 取り込めなかった件数。 */
  failed: number;
  /** 件数の単位。「件」「行」など。 */
  unit?: string;
  /** 再実行など、結果を受けて取る操作。 */
  children?: ReactNode;
};

/**
 * 取り込みの結果を件数で要約する。
 *
 * @remarks
 * **一部だけ失敗した状態を、成功とも失敗とも別に示す。** 「取り込みました」だけでは落ちた行に
 * 気付けず、「失敗しました」だけでは通った行まで取り消したと誤解される。
 *
 * 結果は `role="status"` で伝える。取り込みは時間がかかり、利用者が画面から目を離しているため、
 * 終わったことが見た目の変化だけでは届かない。
 *
 * 取り込みの実行、schema、変換処理は持たない。件数を呼び出し元が渡す。
 *
 * @param props.total - 取り込もうとした件数。
 * @param props.succeeded - 取り込めた件数。
 * @param props.failed - 取り込めなかった件数。
 *
 * @see Storybook `Status/ImportExport`
 */
export function ImportSummary({
  className,
  total,
  succeeded,
  failed,
  unit = "件",
  children,
  ...props
}: ImportSummaryProps) {
  return (
    <Alert
      className={cn(className)}
      data-slot="import-summary"
      role="status"
      variant={failed === 0 ? "default" : "warning"}
      {...props}
    >
      <AlertTitle>
        {failed === 0
          ? `${succeeded} ${unit}を取り込みました`
          : `${total} ${unit}のうち ${failed} ${unit}を取り込めませんでした`}
      </AlertTitle>
      <AlertDescription>
        {failed === 0 ? null : <p>{`${succeeded} ${unit}は取り込み済みです。`}</p>}
        {children}
      </AlertDescription>
    </Alert>
  );
}

/** 取り込めなかった行 1 件。 */
export type ImportRowError = {
  /** 元のファイルでの行番号。 */
  line: number;
  /** 原因になった項目。行全体が原因の場合は省略する。 */
  column?: string;
  /** 利用者が直せる形の理由。 */
  message: string;
};

/** {@link ImportErrorList} の props。 */
export type ImportErrorListProps = ComponentProps<"div"> & {
  /** 取り込めなかった行。 */
  errors: readonly ImportRowError[];
  /** 表の名前。 */
  label?: string;
};

/**
 * 取り込めなかった行を、元のファイルの行番号とともに並べる。
 *
 * @remarks
 * **行番号は元のファイルのものを渡す。** 取り込めた行を詰めた連番にすると、利用者が手元の
 * ファイルのどこを直せばよいか分からなくなる。
 *
 * 項目名は原因が特定の列にある場合だけ渡す。行全体が原因のとき（列数が合わない、など）は空にする。
 *
 * 件数を絞るのは呼び出し元の判断である。この部品は渡された行をすべて並べる。全件が多すぎる場合、
 * 何件目までを見せるかは取り込みの規模によって変わる。
 *
 * @param props.errors - 取り込めなかった行。
 * @param props.label - 表の名前。
 *
 * @see Storybook `Status/ImportExport`
 */
export function ImportErrorList({
  className,
  errors,
  label = "取り込めなかった行",
  ...props
}: ImportErrorListProps) {
  return (
    <div className={cn(className)} data-slot="import-error-list" {...props}>
      <Table aria-label={label} label={label}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">行</TableHead>
            <TableHead className="w-40">項目</TableHead>
            <TableHead>理由</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {errors.map((error) => (
            <TableRow key={`${error.line}-${error.column ?? ""}-${error.message}`}>
              <TableCell>{error.line}</TableCell>
              <TableCell>{error.column ?? "—"}</TableCell>
              <TableCell className="whitespace-normal">{error.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** {@link ExportButton} の props。 */
export type ExportButtonProps = Omit<ComponentProps<typeof Button>, "children"> & {
  /** 出力の生成が進行中か。 */
  pending?: boolean;
  /** 生成が終わり、受け取れる URL。渡すと link になる。 */
  href?: string;
  /** ファイル名。`href` を渡すときに指定する。 */
  fileName?: string;
  /** 操作の文言。 */
  label?: string;
  /** 生成中の文言。 */
  pendingLabel?: string;
};

/**
 * 出力を生成し、できたファイルを受け取る操作。
 *
 * @remarks
 * 生成と受け取りは別の状態である。生成が終わるまでは押せない操作として出し、終わったら
 * `href` を渡して link へ変える。同じ見た目のまま中身だけ変えると、押せるようになったことが
 * 伝わらない。
 *
 * 生成中は文言も変える。spinner だけでは、何を待っているのかが読み上げから分からない。
 *
 * 生成そのもの、出力形式、ファイルの中身は持たない。状態と URL を呼び出し元が渡す。
 *
 * `href` の検証も持たない。同一オリジンかつ `http` / `https` であることは呼び出し元が保証する。
 * `javascript:` を渡すと押下時に実行されるため、生成 API の応答をそのまま流し込まない。
 *
 * @param props.pending - 出力の生成が進行中か。
 * @param props.href - 生成が終わり、受け取れる URL。
 *
 * @see Storybook `Status/ImportExport`
 */
export function ExportButton({
  pending = false,
  href,
  fileName,
  label = "書き出す",
  pendingLabel = "書き出しています",
  ...props
}: ExportButtonProps) {
  if (href !== undefined) {
    return (
      <Button asChild data-slot="export-button" {...props}>
        <a download={fileName} href={href}>
          <DownloadIcon aria-hidden="true" />
          {label}
        </a>
      </Button>
    );
  }

  if (pending) {
    return (
      <Button data-slot="export-button" disabled type="button" {...props}>
        <Spinner />
        {pendingLabel}
      </Button>
    );
  }

  return (
    <Button data-slot="export-button" type="button" {...props}>
      <DownloadIcon aria-hidden="true" />
      {label}
    </Button>
  );
}

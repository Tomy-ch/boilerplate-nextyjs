import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useCallback, useState } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { Spinner } from "@/components/design-system/status/spinner/spinner";
import { ExportButton, ImportErrorList, type ImportRowError, ImportSummary } from "./import-export";

const meta = {
  title: "Status/ImportExport",
  component: ImportSummary,
  parameters: { layout: "padded" },
  args: { total: 120, succeeded: 118, failed: 2 },
} satisfies Meta<typeof ImportSummary>;
export default meta;
type Story = StoryObj<typeof meta>;

const ERRORS = [
  { line: 12, column: "月額", message: "数値として読めません（「¥1,200」）" },
  { line: 27, message: "列の数が合いません（8 列必要ですが 7 列でした）" },
  { line: 45, column: "状態", message: "使えない値です（「公開済」）" },
] satisfies readonly [ImportRowError, ...ImportRowError[]];

/** すべて取り込めた場合。 */
export const AllSucceeded: Story = {
  args: { total: 120, succeeded: 120, failed: 0 },
  render: (args) => (
    <div className="max-w-2xl">
      <ImportSummary {...args} />
    </div>
  ),
};

const RETRY_DELAY_MS = 700;

/** 再実行のたびに、落ちた行が 1 件ずつ通っていく取り込みを模した fixture。 */
function PartiallyFailedFixture({ total }: { total: number }) {
  const [errors, setErrors] = useState<readonly ImportRowError[]>(ERRORS);
  const [pending, setPending] = useState(false);

  const retry = useCallback(() => {
    setPending(true);
    setTimeout(() => {
      setErrors((current) => current.slice(1));
      setPending(false);
    }, RETRY_DELAY_MS);
  }, []);

  const reset = useCallback(() => {
    setPending(false);
    setErrors(ERRORS);
  }, []);

  const failed = errors.length;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <ImportSummary failed={failed} succeeded={total - failed} total={total}>
        <div className="mt-2 flex flex-wrap gap-2">
          {failed === 0 ? null : (
            <Button disabled={pending} onClick={retry} size="sm" type="button">
              {pending ? <Spinner /> : null}
              {pending ? "再実行しています" : `失敗した ${failed} 件を再実行`}
            </Button>
          )}
          <Button onClick={reset} size="sm" type="button" variant={BUTTON_VARIANT.OUTLINE}>
            取り込みをやり直す
          </Button>
        </div>
      </ImportSummary>
      {failed === 0 ? null : <ImportErrorList errors={errors} />}
    </div>
  );
}

/**
 * 一部だけ失敗した場合。成功とも失敗とも別の状態として示し、落ちた行は元のファイルの行番号
 * とともに並べる。再実行を押すと、通った行が要約と一覧の両方から減っていく。
 */
export const PartiallyFailed: Story = {
  render: (args) => <PartiallyFailedFixture total={args.total} />,
};

/** 行全体が原因の場合は項目を空にする。 */
export const RowLevelError: Story = {
  args: { total: 3, succeeded: 2, failed: 1 },
  render: () => (
    <div className="max-w-2xl">
      <ImportErrorList errors={[ERRORS[1]]} />
    </div>
  ),
};

/**
 * 書き出しの 3 状態。生成前・生成中・受け取り可能。
 *
 * 末尾は前の出力を持ったまま次を生成している組で、生成中が勝つ。
 */
export const ExportStates: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <ExportButton />
      <ExportButton pending />
      <ExportButton fileName="plans.csv" href="/exports/plans.csv" />
      <ExportButton fileName="plans.csv" href="/exports/plans.csv" pending />
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AlertTriangleIcon, CircleAlertIcon, InfoIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta = {
  title: "Status/Alert",
  component: Alert,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "注意・失敗・次に取る行動を、**それが関係する場所の文脈内**に置いて伝えます。",
          "画面から消えては困る内容に使い、一時的な通知は `Toaster`、form の送信結果は",
          "`FormFeedback`、領域まるごとの状態は `FeedbackState` を使います。",
          "`variant` は深刻さを表し、色だけに意味を持たせません。アイコンは装飾なので、",
          "何が起きたかは必ず `AlertTitle` の文言が伝えます。状態の判定はこの component が持たず、",
          "呼び出し元が決めて渡します。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。利用者に確認や補足を促す。 */
export const Default: Story = {
  render: () => (
    <Alert className="w-96">
      <InfoIcon />
      <AlertTitle>確認が必要です</AlertTitle>
      <AlertDescription>内容を確認してから次へ進んでください。</AlertDescription>
    </Alert>
  ),
};

/** 失敗した場合。次に取れる行動があるなら本文へ添える。 */
export const Destructive: Story = {
  render: () => (
    <Alert className="w-96" variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>処理を完了できませんでした</AlertTitle>
      <AlertDescription>
        <p>時間をおいてからもう一度お試しください。</p>
        <Button size="sm" type="button" variant="outline">
          再試行する
        </Button>
      </AlertDescription>
    </Alert>
  ),
};

/** 失敗ではないが、そのままでは問題になる場合。 */
export const Warning: Story = {
  render: () => (
    <Alert className="w-96" variant="warning">
      <AlertTriangleIcon />
      <AlertTitle>確認が必要です</AlertTitle>
      <AlertDescription>期限や入力内容を確認してから続行してください。</AlertDescription>
    </Alert>
  ),
};

import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";
import { withPartSpan } from "@/observability/render-span";
import type { WithdrawUserState } from "../../form-state";

/** `WithdrawFeedback` の props。 */
export type WithdrawFeedbackProps = {
  /** 直前の退会の結果。 */
  state: WithdrawUserState;
};

/**
 * 退会させた結果の報せ。
 *
 * @remarks
 * **一覧の上に置きます。**確認の面は結果が返ると閉じるので、その中に出した文言は一緒に消えます。
 * 退会が成立した行は「有効」で絞り込んでいれば一覧からも消えるため、何が起きたかを残せる場所が
 * 一覧の外側にしかありません（[0063](../../../../../../docs/adr/0063-mutation-result-notification.md)）。
 *
 * 成立の報せに後始末の但し書きを添えます。退会そのものは終わっていても、購入の取消と在庫の
 * 戻しは後から順に進むためです（[0070](../../../../../../docs/adr/0070-backend-role-separation.md)）。
 * 添えないと、一覧を見た人はもう在庫も戻っていると読みます。
 *
 * @see Storybook `Features/Admin/Users/WithdrawFeedback`
 */
export const WithdrawFeedback = withPartSpan(
  "features/admin/users/ui/withdraw-feedback/withdraw-feedback",
  ({ state }: WithdrawFeedbackProps) => {
    if (state.status === "success") {
      return (
        <Alert>
          <AlertTitle>{state.value.name} を退会させました</AlertTitle>
          <AlertDescription>
            進行中の購入の取消と在庫の戻しは後から順に進みます。一覧にすぐ反映されないことがあります。
          </AlertDescription>
        </Alert>
      );
    }

    if (state.status === "error" && state.formError !== null) {
      return (
        <Alert variant="destructive">
          <AlertTitle>退会させられませんでした</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      );
    }

    return null;
  },
);

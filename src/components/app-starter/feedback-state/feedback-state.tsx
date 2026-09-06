import { Spinner } from "@/components/design-system/status/spinner/spinner";
import { CircleAlertIcon, CircleCheckIcon, type IconComponent, InboxIcon } from "@/components/icon";

import { FEEDBACK_STATE_KIND, type FeedbackStateKind } from "./feedback-state.definition";

/** {@link FeedbackState} の props。 */
export type FeedbackStateProps = {
  /** 表示する画面状態。アイコンと通知の role を決める。 */
  kind: FeedbackStateKind;
  /** 状態を短く説明する見出し。 */
  title: string;
  /** 状態の原因、次に取れる行動などを補足する任意の説明。 */
  description?: string;
};

const feedbackStateIcon: Record<Exclude<FeedbackStateKind, "loading">, IconComponent> = {
  [FEEDBACK_STATE_KIND.EMPTY]: InboxIcon,
  [FEEDBACK_STATE_KIND.ERROR]: CircleAlertIcon,
  [FEEDBACK_STATE_KIND.SUCCESS]: CircleCheckIcon,
};

/**
 * ローディング・空・失敗・成功の 4 状態を、一貫した文書構造と通知で表示する。
 *
 * @remarks
 * エラーは `role="alert"`、その他は `role="status"` を使う。アイコンは装飾であり、
 * 状態の意味は必ず `title` と必要に応じた `description` で伝える。
 *
 * 画面固有の再試行・遷移・入力修正などの操作は、呼び出し元でこの部品の前後に合成する。
 * backend の詳細や request ID を表示する場合は、利用者に意味が通じる文言へ変換してから
 * `description` または画面固有の補助要素へ渡す。
 *
 * @example
 * ```tsx
 * <FeedbackState
 *   kind={FEEDBACK_STATE_KIND.EMPTY}
 *   title="表示できる通知はありません"
 *   description="条件を変更して再度確認してください。"
 * />
 * ```
 *
 * @param props - 表示する状態と利用者に伝える文言。
 * @param props.kind - アイコンと通知の role を決める画面状態。
 * @param props.title - すべての状態で必須の、短い状態説明。
 * @param props.description - 原因・次の行動を補足する任意の説明。
 * @see Storybook `View State/Feedback State`
 */
export function FeedbackState({ kind, title, description }: FeedbackStateProps) {
  const role = kind === FEEDBACK_STATE_KIND.ERROR ? "alert" : "status";

  return (
    <section
      aria-live={kind === FEEDBACK_STATE_KIND.ERROR ? "assertive" : "polite"}
      className="grid max-w-sm justify-items-center gap-2 rounded-lg p-6 text-center"
      role={role}
    >
      {kind === FEEDBACK_STATE_KIND.LOADING ? (
        <Spinner className="size-8" />
      ) : (
        <FeedbackStateIcon kind={kind} />
      )}
      <h2 className="font-emphasis">{title}</h2>
      {description === undefined ? null : <p className="text-muted-foreground">{description}</p>}
    </section>
  );
}

function FeedbackStateIcon({ kind }: { kind: Exclude<FeedbackStateKind, "loading"> }) {
  const Icon = feedbackStateIcon[kind];

  return <Icon aria-hidden="true" className="size-8" />;
}

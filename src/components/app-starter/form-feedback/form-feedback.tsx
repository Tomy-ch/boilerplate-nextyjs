import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";

/** Server Action の結果を利用者向けに表示する SSR first feedback。 */
export type FormFeedbackProps = {
  /** 表示する要約。 */
  title: string;
  /** 影響や次の行動を示す説明。 */
  description?: ReactNode;
  /** 連絡のときに伝える request ID。 */
  requestId?: string;
  /** 通常・warning・destructive の見た目。 */
  variant?: "default" | "warning" | "destructive";
  /** link など、次の行動へ進む要素。 */
  children?: ReactNode;
};

/**
 * Server Action の結果を要約し、次の行動と request ID を表示する。
 *
 * @see Storybook `Feedback/FormFeedback`
 */
export function FormFeedback({
  title,
  description,
  requestId,
  variant = "default",
  children,
}: FormFeedbackProps) {
  return (
    <Alert variant={variant}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {description}
        {requestId === undefined ? null : <p>リクエスト ID: {requestId}</p>}
        {children}
      </AlertDescription>
    </Alert>
  );
}

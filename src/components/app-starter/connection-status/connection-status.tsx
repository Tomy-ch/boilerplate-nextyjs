import type { ComponentProps } from "react";

import { Badge } from "../../design-system/display/badge/badge";
import {
  BADGE_VARIANT,
  type BadgeVariant,
} from "../../design-system/display/badge/badge.definition";
import { CONNECTION_STATUS, type ConnectionStatusValue } from "./connection-status.definition";

/** 状態ごとの文言と、視覚的な優先度。 */
const PRESENTATION: Readonly<Record<ConnectionStatusValue, { label: string; tone: BadgeVariant }>> =
  {
    [CONNECTION_STATUS.CONNECTING]: { label: "接続中", tone: BADGE_VARIANT.SECONDARY },
    [CONNECTION_STATUS.RECEIVING]: { label: "受信中", tone: BADGE_VARIANT.SUCCESS },
    [CONNECTION_STATUS.RECONNECTING]: { label: "再接続中", tone: BADGE_VARIANT.WARNING },
    [CONNECTION_STATUS.OFFLINE]: { label: "オフライン", tone: BADGE_VARIANT.WARNING },
    [CONNECTION_STATUS.SUSPENDED]: { label: "待機中", tone: BADGE_VARIANT.SECONDARY },
    [CONNECTION_STATUS.HALTED]: { label: "受信を停止しました", tone: BADGE_VARIANT.DESTRUCTIVE },
    [CONNECTION_STATUS.EXPIRED]: {
      label: "ログインし直すと再開します",
      tone: BADGE_VARIANT.DESTRUCTIVE,
    },
  };

/** {@link ConnectionStatus} の props。 */
export type ConnectionStatusProps = Omit<ComponentProps<typeof Badge>, "children" | "variant"> & {
  /** いまの受信の状態。 */
  status: ConnectionStatusValue;
};

/**
 * 継続的な受信がいまどうなっているかを示す、短いラベル。
 *
 * @remarks
 * 通信そのものを持たない表示専用の Server Component である。接続も再接続も状態の判定も持たず、
 * 渡された状態に対応する文言を出すだけである。**どの状態をいつ渡すかは呼び出し元が決める。**
 *
 * `status` の意味論は支援技術へ `role="status"` として伝わる。割り込まずに変化だけを伝えるため
 * `aria-live` は `polite` であり、読み落とされては困る通知には `Alert` を使う。
 *
 * **出したままにする前提の部品である。** 切れている間だけ出す使い方もできるが、その場合は
 * 「出ていない」が「繋がっている」と「そもそも受信していない」のどちらなのかを画面が別に示す
 * 必要がある。
 *
 * 色は文言に重ねているだけで、色だけで区別させない。
 *
 * @param props - `Badge` の属性と、以下の表示用 props。
 * @param props.status - いまの受信の状態。
 *
 * @see Storybook `Status/ConnectionStatus`
 */
export function ConnectionStatus({ status, ...props }: ConnectionStatusProps) {
  const presentation = PRESENTATION[status];

  return (
    <Badge
      aria-live="polite"
      data-slot="connection-status"
      data-status={status}
      role="status"
      variant={presentation.tone}
      {...props}
    >
      {presentation.label}
    </Badge>
  );
}

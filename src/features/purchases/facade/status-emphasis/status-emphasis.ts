import {
  BADGE_VARIANT,
  type BadgeVariant,
} from "@/components/design-system/display/badge/badge.definition";
import { PURCHASE_STATUS } from "@/model/purchase/purchase-status";

/**
 * 望ましい終端に達した購入のステータス。
 *
 * @remarks
 * バックエンドの状態遷移で「そこから他の状態へ遷移しない」かつ「取り消しではない」ものです。
 */
const SETTLED_STATUS_CODES: ReadonlySet<number> = new Set([
  PURCHASE_STATUS.COMPLETED,
  PURCHASE_STATUS.DELIVERED,
]);

/** 取り消された購入のステータス。買ったものが届かない終端はこれだけです。 */
const CANCELED_STATUS_CODES: ReadonlySet<number> = new Set([PURCHASE_STATUS.CANCELED]);

/** 進行中のステータス。終端でも取り消しでもない、マスタに載っている業務キー。 */
const IN_PROGRESS_STATUS_CODES: ReadonlySet<number> = new Set([
  PURCHASE_STATUS.UNPROCESSED,
  PURCHASE_STATUS.ACCEPTED,
  PURCHASE_STATUS.CONFIRMING,
  PURCHASE_STATUS.PROCESSING,
  PURCHASE_STATUS.PAID,
  PURCHASE_STATUS.SHIPPED,
]);

/**
 * 知らない業務キーの見た目。
 *
 * @remarks
 * **マスタはこちらの都合と関係なく増えます。** 知らない業務キーを 3 つのどれかへ寄せると、確かめて
 * いない意味を主張することになります。装飾を持たない姿は「区分を決めていない」ことをそのまま示し、
 * 名称は文字で出るので一覧は読めます。
 */
const UNKNOWN_STATUS_EMPHASIS: BadgeVariant = BADGE_VARIANT.GHOST;

/**
 * ステータスの業務キーから、badge の見た目を選ぶ。
 *
 * @remarks
 * マスタに無い業務キーは {@link UNKNOWN_STATUS_EMPHASIS} に倒し、進行中へは寄せません。
 *
 * `facade` に置くのは、購入完了とも共有する控え（`receipt.tsx`）がこの対応を必要とするためです
 * （README 参照）。
 *
 * 3 つに束ねる根拠と、色を文言の補強に留める根拠は
 * [画面要件](../../../../../docs/spec/route/shop/purchases/page.screen.md)「状況」。
 */
export function toStatusEmphasis(statusCode: number): BadgeVariant {
  if (SETTLED_STATUS_CODES.has(statusCode)) {
    return BADGE_VARIANT.SUCCESS;
  }

  if (CANCELED_STATUS_CODES.has(statusCode)) {
    return BADGE_VARIANT.DESTRUCTIVE;
  }

  if (IN_PROGRESS_STATUS_CODES.has(statusCode)) {
    return BADGE_VARIANT.SECONDARY;
  }

  return UNKNOWN_STATUS_EMPHASIS;
}

import {
  BADGE_VARIANT,
  type BadgeVariant,
} from "@/components/design-system/display/badge/badge.definition";

/**
 * 状態のコードに対応する見た目。
 *
 * @remarks
 * **契約は状態の意味を返しません。** マスタが持つのは `code` と表示名だけなので、意味づけはこの
 * 画面が持ちます。色は 1 件の状態ではなく扱いの区分に付けます。区分と割り当ての理由は
 * `docs/spec/route/admin/products/page.function.md`「状態に色を割り当てるのはこの画面」。
 *
 * バッジは状態名も出すので、色だけで区別させません。
 */
const STATUS_TONE: Readonly<Record<number, BadgeVariant>> = {
  1: BADGE_VARIANT.SECONDARY, // 在庫あり
  2: BADGE_VARIANT.DESTRUCTIVE, // 在庫切れ
  3: BADGE_VARIANT.WARNING, // 予約受付中
  4: BADGE_VARIANT.OUTLINE, // 販売終了
  5: BADGE_VARIANT.WARNING, // 取り寄せ中
  6: BADGE_VARIANT.WARNING, // 入荷待ち
  7: BADGE_VARIANT.OUTLINE, // 廃盤
  8: BADGE_VARIANT.OUTLINE, // 検討中
  9: BADGE_VARIANT.WARNING, // 再入荷予定
  10: BADGE_VARIANT.SECONDARY, // 限定販売
};

/**
 * 知らない状態の見た目。
 *
 * @remarks
 * **マスタはこちらの都合と関係なく増えます。** 知らない状態を既存のどれかへ寄せると、意味を
 * 取り違えた色が付きます。**装飾を持たない姿**は「区分を決めていない」ことをそのまま示します。
 * 区分の決まっている状態は塗りか枠線で囲まれた形を持つので、決まっていないものだけが形を持たず、
 * 素の文字で出ます。
 */
const UNKNOWN_STATUS_TONE: BadgeVariant = BADGE_VARIANT.GHOST;

/**
 * 状態のコードから、バッジの見た目を選ぶ。
 *
 * @param code - 状態マスタのコード。マスタに見つからなければ undefined
 */
export function toStatusTone(code: number | undefined): BadgeVariant {
  return (code === undefined ? undefined : STATUS_TONE[code]) ?? UNKNOWN_STATUS_TONE;
}

import * as z from "zod/mini";

import type { CursorPage } from "../pagination";

/**
 * 問い合わせの識別子を確定させるスキーマ。
 *
 * @remarks
 * 生成スキーマの中で組み合わせる呼び出しがこれを直接使い、それ以外は {@link toInquiryId} を
 * 通します。
 */
export const inquiryIdSchema = z.string().brand<"inquiry">();

/**
 * 問い合わせを指す識別子。
 *
 * @remarks
 * 素の `string` を代入できない形にしてあります。問い合わせ・メッセージ・利用者の識別子はいずれも
 * UUID の文字列で、取り違えても型では止まらないためです。
 */
export type InquiryId = z.infer<typeof inquiryIdSchema>;

/**
 * 文字列を問い合わせの識別子として確定させる。
 *
 * @remarks
 * **呼んでよいのは境界だけ**です。外から来た値を確定させる場所（`adapters` の検証の出口・
 * route の動的セグメント）で 1 度だけ通し、内側では確定した型を持ち回ります。
 */
export function toInquiryId(value: string): InquiryId {
  return inquiryIdSchema.parse(value);
}

/** メッセージの送り手の種別。 */
export const INQUIRY_AUTHOR_KIND = {
  /** 問い合わせた利用者自身。 */
  user: "user",
  /** 回答する運営。 */
  operator: "operator",
} as const;

/**
 * メッセージの送り手。
 *
 * @remarks
 * 契約が載せるのは種別だけで、主体の識別子は含みません。誰が答えたかは画面が扱える情報では
 * ないため、運営の発言はすべて同じ送り手として並びます。
 */
export type InquiryAuthorKind = (typeof INQUIRY_AUTHOR_KIND)[keyof typeof INQUIRY_AUTHOR_KIND];

/**
 * 問い合わせのメッセージ 1 通。
 *
 * @remarks
 * 契約の wire 型ではなく、表示のための型です。追記しかされないため、同じ `id` の 2 通が別の
 * 内容を持つことはありません。届いた順が前後しても `id` で重複を落とせるのはこのためです。
 */
export type InquiryMessage = {
  /** メッセージの識別子。楽観追加した行と、購読で届いた行の突合に使う。 */
  readonly id: string;
  readonly authorKind: InquiryAuthorKind;
  readonly body: string;
  /** 問い合わせ内での位置。1 起算で欠番が無く、並べ替えの基準になる。 */
  readonly sequence: number;
  readonly createdAt: Date;
};

/**
 * 問い合わせの履歴 1 ページ。
 *
 * @remarks
 * `streamCursor` はこのページを読んだ時点の購読の位置です。**購読の開始位置としてそのまま
 * 渡します** —— `messages` はこの位置以下だけを含むため、取得と購読の間に追加された分が
 * 抜け落ちません。
 */
export type InquiryHistory = {
  /** 対象の問い合わせ。まだ 1 通も送っていない利用者では `null`。 */
  readonly inquiryId: InquiryId | null;
  /** 位置の昇順に並んだメッセージ。 */
  readonly messages: readonly InquiryMessage[];
  /** 次ページの開始位置。次ページが無ければ `null`。 */
  readonly nextAfterSequence: number | null;
  /** このページを読んだ時点の購読の位置。まだ 1 通も無ければ `0`。 */
  readonly streamCursor: number;
};

/**
 * 運営向け一覧の 1 件。
 *
 * @remarks
 * 本文を持ちません。一覧は行だけで組み立て、本文が要るときは履歴を取り直します。
 */
export type InquirySummary = {
  readonly id: InquiryId;
  /** 問い合わせを開始した利用者。 */
  readonly userId: string;
  readonly createdAt: Date;
  /** 最後にメッセージが追加された日時。一覧の並び順の基準。 */
  readonly updatedAt: Date;
};

/** cursor 方式で取得した問い合わせ一覧の 1 ページ。 */
export type InquiryListPage = CursorPage<InquirySummary>;

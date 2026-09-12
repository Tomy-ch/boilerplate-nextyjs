import type { InquiryHistory, InquiryMessage } from "@/model/inquiry/inquiry";
import { INQUIRY_AUTHOR_KIND, toInquiryId } from "@/model/inquiry/inquiry";

/** カタログとテストで使う問い合わせ。 */
export const INQUIRY_ID = toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60");

/**
 * 日付をまたぐやり取り。
 *
 * @remarks
 * **2 日ぶんを置きます。** 日付の区切りは 2 日目が現れて初めて出るため、1 日ぶんでは区切りの
 * 見え方を確かめられません。
 */
export const MESSAGES: readonly InquiryMessage[] = [
  {
    id: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01",
    authorKind: INQUIRY_AUTHOR_KIND.user,
    body: "注文した商品がまだ届きません。発送状況を教えてください。",
    sequence: 1,
    createdAt: new Date("2026-09-01T01:00:00.000Z"),
  },
  {
    id: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a02",
    authorKind: INQUIRY_AUTHOR_KIND.operator,
    body: "お問い合わせありがとうございます。確認いたしますので、少々お待ちください。",
    sequence: 2,
    createdAt: new Date("2026-09-01T01:05:00.000Z"),
  },
  {
    id: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a03",
    authorKind: INQUIRY_AUTHOR_KIND.operator,
    body: "お待たせしました。本日中に発送の予定です。追跡番号は発送時にご案内します。",
    sequence: 3,
    createdAt: new Date("2026-09-02T02:10:00.000Z"),
  },
  {
    id: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a04",
    authorKind: INQUIRY_AUTHOR_KIND.user,
    body: "ありがとうございます。よろしくお願いします。",
    sequence: 4,
    createdAt: new Date("2026-09-02T02:12:00.000Z"),
  },
];

/** やり取りのある履歴。購読の開始位置は最後の位置と一致する。 */
export const HISTORY: InquiryHistory = {
  inquiryId: INQUIRY_ID,
  messages: MESSAGES,
  nextAfterSequence: null,
  streamCursor: 4,
};

/**
 * まだ 1 通も無い履歴。
 *
 * @remarks
 * 問い合わせがまだ作られていないため識別子を持ちません。**取得の失敗とは別の状態**で、
 * 契約はこれを成功として返します。
 */
export const EMPTY_HISTORY: InquiryHistory = {
  inquiryId: null,
  messages: [],
  nextAfterSequence: null,
  streamCursor: 0,
};

/** 折り返しを確かめるための、区切りの無い長い本文。 */
export const LONG_BODY_HISTORY: InquiryHistory = {
  inquiryId: INQUIRY_ID,
  messages: [
    {
      id: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a05",
      authorKind: INQUIRY_AUTHOR_KIND.user,
      body: `届いた商品の型番が注文したものと違うようです。${"確認をお願いします。".repeat(12)}`,
      sequence: 1,
      createdAt: new Date("2026-09-02T03:00:00.000Z"),
    },
    {
      id: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a06",
      authorKind: INQUIRY_AUTHOR_KIND.operator,
      body: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789",
      sequence: 2,
      createdAt: new Date("2026-09-02T03:05:00.000Z"),
    },
  ],
  nextAfterSequence: null,
  streamCursor: 2,
};

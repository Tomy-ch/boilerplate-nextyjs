import type { InquiryHistory, InquirySummary } from "@/model/inquiry/inquiry";
import { INQUIRY_AUTHOR_KIND, toInquiryId } from "@/model/inquiry/inquiry";

/** カタログとテストで使う、運営向け一覧の行。更新の新しい順で並べてある。 */
export const ADMIN_INQUIRY_ROWS: readonly InquirySummary[] = [
  {
    id: toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60"),
    userId: "550e8400-e29b-41d4-a716-446655440000",
    createdAt: new Date("2026-09-01T01:00:00.000Z"),
    updatedAt: new Date("2026-09-02T02:12:00.000Z"),
  },
  {
    id: toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61"),
    userId: "550e8400-e29b-41d4-a716-446655440001",
    createdAt: new Date("2026-08-28T05:30:00.000Z"),
    updatedAt: new Date("2026-09-01T23:40:00.000Z"),
  },
  {
    id: toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a62"),
    userId: "550e8400-e29b-41d4-a716-446655440002",
    createdAt: new Date("2026-08-20T09:15:00.000Z"),
    updatedAt: new Date("2026-08-21T00:05:00.000Z"),
  },
];

/** 対応の画面が読む問い合わせ。 */
export const ADMIN_INQUIRY_ID = toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60");

/** 別の問い合わせ。開いていない 1 件の更新を区別するために置く。 */
export const OTHER_INQUIRY_ID = toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61");

/**
 * 運営から見たやり取り。
 *
 * @remarks
 * **利用者側の fixture を読みません。** feature の slice どうしは互いを参照せず、同じ題材でも
 * 読む側が自分の入力を持ちます。
 */
export const ADMIN_INQUIRY_HISTORY: InquiryHistory = {
  inquiryId: ADMIN_INQUIRY_ID,
  messages: [
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
      body: "お待たせしました。本日中に発送の予定です。",
      sequence: 3,
      createdAt: new Date("2026-09-02T02:10:00.000Z"),
    },
  ],
  nextAfterSequence: null,
  streamCursor: 3,
};

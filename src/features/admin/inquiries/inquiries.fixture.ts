import type { InquirySummary } from "@/model/inquiry/inquiry";
import { toInquiryId } from "@/model/inquiry/inquiry";

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

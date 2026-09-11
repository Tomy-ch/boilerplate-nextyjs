import { InquiryBreadcrumbTrail } from "../ui/breadcrumb-trail/breadcrumb-trail";

/**
 * 問い合わせ 1 件の画面の、現在地までの階層。
 *
 * @remarks
 * 現在地に識別子を出しません。問い合わせには題名が無く、識別子をそのまま出しても階層の名前に
 * ならないためです。誰のものかは画面の中が示します。
 */
export function AdminInquiryDetailBreadcrumbContent() {
  return <InquiryBreadcrumbTrail trail={["対応"]} />;
}

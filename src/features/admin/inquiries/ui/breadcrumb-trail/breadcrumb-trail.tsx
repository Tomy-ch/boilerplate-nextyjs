import Link from "next/link";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/design-system/navigation/breadcrumb/breadcrumb";
import { withPartSpan } from "@/observability/render-span";

import { ADMIN_INQUIRY_LIST_PATH } from "../../../paths";

const ROOT_LABEL = "問い合わせ管理";

/** `InquiryBreadcrumbTrail` の props。 */
export type InquiryBreadcrumbTrailProps = {
  /** 一覧より下の現在地。並び順がそのまま階層になる。 */
  trail: readonly string[];
};

/**
 * 問い合わせまわりの画面の、現在地までの階層。
 *
 * @remarks
 * 一覧へ戻る先頭の 1 段はどの画面でも同じなので、ここが持ちます。
 */
export const InquiryBreadcrumbTrail = withPartSpan(
  "features/admin/inquiries/ui/breadcrumb-trail/breadcrumb-trail",
  ({ trail }: InquiryBreadcrumbTrailProps) => {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={ADMIN_INQUIRY_LIST_PATH}>{ROOT_LABEL}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {trail.map((label) => (
            <Fragment key={label}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{label}</BreadcrumbPage>
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    );
  },
);

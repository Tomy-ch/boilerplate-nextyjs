import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { MAX_UPLOAD_BYTES } from "@/config/http/http.client";
import { AdminProductEditPageContent } from "@/features/admin/products/edit/page-content";
import { AdminProductEditSkeleton } from "@/features/admin/products/edit/ui/skeleton/skeleton";
import { toProductId } from "@/model/product/product";

import { updateProductAction, uploadProductImageAction } from "../../actions";

export const metadata: Metadata = {
  title: "商品の編集",
  robots: { index: false, follow: false },
};

/**
 * 編集の中身。
 *
 * @remarks
 * **`params` を解くのはここです。** 器の側で待つと、待っている間は殻すら配れません。
 * 器は promise のまま渡し、穴の内側で解きます。識別子を契約の型へ通すのもこの層の仕事です。
 */
async function AdminProductEditContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AdminProductEditPageContent
      id={toProductId(id)}
      maxUploadBytes={MAX_UPLOAD_BYTES}
      updateAction={updateProductAction}
      uploadAction={uploadProductImageAction}
    />
  );
}

/** 商品を編集する画面。 */
export default function AdminProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>商品の編集</PageHeaderTitle>
          <PageHeaderDescription>
            観点を選んで直します。更新すると一覧へ戻ります。
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<AdminProductEditSkeleton />}>
        <AdminProductEditContent params={params} />
      </Suspense>
    </ContentContainer>
  );
}

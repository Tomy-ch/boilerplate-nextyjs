"use client";

import Link from "next/link";
import { useActionState, useCallback, useId, useMemo, useState } from "react";

import { Button } from "@/components/design-system/action/button/button";
import {
  TabsClient,
  TabsClientContent,
  TabsClientList,
  TabsClientTrigger,
} from "@/components/design-system/navigation/tabs-client/tabs-client";
import { ErrorKind } from "@/errors/error-kind";
import { idleActionState } from "@/model/action-state";
import type { Product } from "@/model/product/product";

import { adminProductEditPath } from "../../paths";
import { PRODUCT_FORM_NAMES } from "../form-names";
import {
  findFirstInvalidSection,
  PRODUCT_FORM_SECTIONS,
  PRODUCT_SECTION_TITLES,
} from "../form-sections";
import type {
  ProductFormState,
  UpdateProductAction,
  UploadProductImageAction,
} from "../form-state";
import { ProductBasicsSection } from "../ui/basics-section/basics-section";
import { ProductDescriptionSection } from "../ui/description-section/description-section";
import { ProductFormFeedback } from "../ui/form-feedback/form-feedback";
import { ProductImagesSection } from "../ui/images-section/images-section";
import { ProductPublishSection } from "../ui/publish-section/publish-section";
import type { ProductSelectOption } from "../ui/select-field/select-field";
import { ProductSubmitButton } from "../ui/submit-button/submit-button";
import { useProductForm } from "../use-product-form";
import type { ProductSavedImage } from "../use-product-images";
import { productValuesOf } from "../use-product-values";

/** `AdminProductEditView` の props。 */
export type AdminProductEditViewProps = {
  /** 編集する商品。読み込んだ時点の版を含む。 */
  product: Product;
  /** 読み込んだ時点で保存されている画像。表示 URL まで解決済み。 */
  savedImages: readonly ProductSavedImage[];
  /** 選べる分類。 */
  categoryOptions: readonly ProductSelectOption[];
  /** 選べる状態。 */
  statusOptions: readonly ProductSelectOption[];
  /** 受け付ける 1 枚あたりの大きさ（byte）。 */
  maxUploadBytes: number;
  /** 商品を更新する送信先。 */
  updateAction: UpdateProductAction;
  /** 画像を送る送信先。 */
  uploadAction: UploadProductImageAction;
};

/**
 * 順番を持たせず、観点を切り替えて 1 か所を直させる商品編集の器。
 *
 * @remarks
 * 編集で主なのは 1 か所を直すことなので、順番を持つ器にすると直したい所へ行くのに段を踏まされます。
 * 段の中身は作る画面と同じ部品で、器だけが違います。
 *
 * **選んでいない観点も DOM に残します**（`forceMount`）。既定では外れるため、観点を切り替えた
 * 時点で入力途中の値が消え、送信にも載りません。残したうえで `hidden` を自分で渡すのは、
 * 「DOM に在る」ことと「見えている」ことが別だからです。
 *
 * **送信が弾かれたら、誤りのある観点へ移ります。**そうしないと、画面のどこも赤くないのに送信
 * だけが通らない状態になります。順番を持たない器は、進む前に止める `wizard` の仕組みを持たない
 * ためです。
 *
 * **観点を移すか入力を直した時点で、直前の結果は下げます。**結果は次の送信まで残り続けるため、
 * 出し続けると直したのに直っていないように見えます。
 *
 * 読み込んだ時点の版を hidden の欄で持ち回ります。その間に別の人が更新していれば送信が拒まれ、
 * **そのときだけ**読み込み直す導線を出します。権限や通信の失敗にまで添えると、やり直せば直る
 * ものとして読めてしまいます。
 */
export function AdminProductEditView({
  categoryOptions,
  maxUploadBytes,
  product,
  savedImages,
  statusOptions,
  updateAction,
  uploadAction,
}: AdminProductEditViewProps) {
  const idPrefix = useId();
  const [state, formAction] = useActionState<ProductFormState, FormData>(
    updateAction,
    idleActionState(),
  );
  const initialValues = useMemo(() => productValuesOf(product), [product]);
  const { dismiss, dismissed, images, rejection, resultIsNew, values } = useProductForm({
    initialValues,
    maxUploadBytes,
    savedImages,
    state,
    uploadAction,
    withQuantity: false,
  });

  // 説明欄だけは値の更新と結果の取り下げを 1 つの handler にまとめる。他の項目は form 全体の
  // `onInput` が取り下げを担うが、編集面は input event を出さない。
  const changeDescription = useCallback(
    (value: string) => {
      values.setValue("description", value);
      dismiss();
    },
    [dismiss, values],
  );
  const [section, setSection] = useState<string>(PRODUCT_FORM_SECTIONS[0]);

  // 送信の結果が入れ替わった描画で観点を寄せる。effect にすると寄せる前の描画が一度挟まり、
  // 誤りのある欄が隠れたまま「どこも赤くないのに送信だけ通らない」画面が一瞬現れる。
  if (resultIsNew) {
    const invalidSection =
      state.status === "error" ? findFirstInvalidSection(state.fieldErrors) : undefined;

    if (invalidSection !== undefined) setSection(invalidSection);
  }

  // 合図は分類であって文言ではない。文言へ動的な要素を足した瞬間に導線が黙って消えるため
  // （どの失敗に添えるかは上の @remarks）。
  const conflicted = state.status === "error" && state.kind === ErrorKind.CONFLICT;

  const changeSection = useCallback(
    (next: string) => {
      setSection(next);
      dismiss();
    },
    [dismiss],
  );

  return (
    <form action={formAction} className="grid gap-8" onInput={dismiss}>
      <input name="id" type="hidden" value={product.id} />
      <input name={PRODUCT_FORM_NAMES.version} type="hidden" value={product.version} />

      <ProductFormFeedback
        dismissed={dismissed}
        idPrefix={idPrefix}
        state={state}
        title="更新できませんでした"
      >
        {conflicted ? (
          <Button asChild size="sm" variant="outline">
            <Link href={adminProductEditPath(product.id)}>読み込み直す</Link>
          </Button>
        ) : null}
      </ProductFormFeedback>

      <TabsClient onValueChange={changeSection} value={section}>
        <TabsClientList aria-label="編集する観点">
          {PRODUCT_FORM_SECTIONS.map((value) => (
            <TabsClientTrigger key={value} value={value}>
              {PRODUCT_SECTION_TITLES[value]}
            </TabsClientTrigger>
          ))}
        </TabsClientList>
        <TabsClientContent forceMount={true} hidden={section !== "basics"} value="basics">
          <ProductBasicsSection
            categoryOptions={categoryOptions}
            form={values}
            idPrefix={idPrefix}
            withQuantity={false}
          />
        </TabsClientContent>
        <TabsClientContent forceMount={true} hidden={section !== "description"} value="description">
          <ProductDescriptionSection
            active={section === "description"}
            idPrefix={idPrefix}
            initialValue={initialValues.description}
            onValueChange={changeDescription}
            value={values.values.description}
          />
        </TabsClientContent>
        <TabsClientContent forceMount={true} hidden={section !== "images"} value="images">
          <ProductImagesSection
            idPrefix={idPrefix}
            images={images}
            maxUploadBytes={maxUploadBytes}
            onReject={rejection.onReject}
            rejection={rejection.rejection}
          />
        </TabsClientContent>
        <TabsClientContent forceMount={true} hidden={section !== "publish"} value="publish">
          <ProductPublishSection form={values} idPrefix={idPrefix} statusOptions={statusOptions} />
        </TabsClientContent>
      </TabsClient>

      <div>
        <ProductSubmitButton
          blocked={images.uploading || images.failed}
          label="更新する"
          pendingLabel="更新しています…"
        />
      </div>
    </form>
  );
}

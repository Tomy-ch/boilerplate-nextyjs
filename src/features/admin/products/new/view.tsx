"use client";

import { useActionState, useCallback, useId, useMemo } from "react";

import { WizardForm } from "@/components/patterns/wizard-form/wizard-form";
import { idleActionState } from "@/model/action-state";
import { PRODUCT_SECTION_TITLES } from "../form-sections";
import type {
  CreateProductAction,
  ProductFormState,
  UploadProductImageAction,
} from "../form-state";
import { ProductBasicsSection } from "../ui/basics-section/basics-section";
import { ProductConfirmSection } from "../ui/confirm-section/confirm-section";
import { ProductDescriptionSection } from "../ui/description-section/description-section";
import { ProductFormFeedback } from "../ui/form-feedback/form-feedback";
import { ProductImagesSection } from "../ui/images-section/images-section";
import { ProductPublishSection } from "../ui/publish-section/publish-section";

import type { ProductSelectOption } from "../ui/select-field/select-field";
import { ProductSubmitButton } from "../ui/submit-button/submit-button";
import { useProductForm } from "../use-product-form";
import { emptyProductValues } from "../use-product-values";

/** `AdminProductCreateView` の props。 */
export type AdminProductCreateViewProps = {
  /** 選べる分類。 */
  categoryOptions: readonly ProductSelectOption[];
  /** 選べる状態。 */
  statusOptions: readonly ProductSelectOption[];
  /** 受け付ける 1 枚あたりの大きさ（byte）。 */
  maxUploadBytes: number;
  /** 商品を作る送信先。 */
  createAction: CreateProductAction;
  /** 画像を送る送信先。 */
  uploadAction: UploadProductImageAction;
};

/**
 * 「あとどれだけで送れるか」を示すため、段階に分けて進ませる商品作成の器。
 *
 * @remarks
 * 進捗と行き来だけを `WizardForm` が持ちます。段の中身は編集の画面と同じ部品で、器だけが違います。
 *
 * **埋まっていない段からは進めません。**同じ規則を Server Action も通りますが、往復して初めて
 * 「入っていない」と言われるより、その場で判る方が直しやすいためです。誤りの文言を触れた項目から
 * 出す理由は `useProductValues` が持ちます。
 *
 * **最後に確認の段を置きます。**作成は取り消せる操作ではなく、送る前に全体を一度読める場所が
 * 要ります。確認は入力欄を持たず、送ろうとしている値をそのまま出します。
 *
 * 入力欄へ native の `required` を与えません。隠れた段の欄が空だとブラウザが focus できず、送信が
 * 理由も示さずに止まります。
 *
 * 画像を送り終わるまで送信を止めます。載るのは保存済みのキーだけなので、途中で送ると、上げた
 * つもりの画像を持たない商品ができます。
 */
export function AdminProductCreateView({
  categoryOptions,
  createAction,
  maxUploadBytes,
  statusOptions,
  uploadAction,
}: AdminProductCreateViewProps) {
  const idPrefix = useId();
  const [state, formAction] = useActionState<ProductFormState, FormData>(
    createAction,
    idleActionState(),
  );
  const initialValues = useMemo(() => emptyProductValues(), []);
  const { dismiss, dismissed, images, rejection, values } = useProductForm({
    initialValues,
    maxUploadBytes,
    state,
    uploadAction,
    withQuantity: true,
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

  return (
    <form action={formAction} className="grid gap-8" onInput={dismiss}>
      <ProductFormFeedback
        dismissed={dismissed}
        idPrefix={idPrefix}
        state={state}
        title="登録できませんでした"
      />
      <WizardForm
        label="商品の登録"
        steps={[
          {
            id: "basics",
            title: PRODUCT_SECTION_TITLES.basics,
            blocked: values.isSectionBlocked("basics"),
            content: (
              <ProductBasicsSection
                categoryOptions={categoryOptions}
                form={values}
                idPrefix={idPrefix}
                withQuantity={true}
              />
            ),
          },
          {
            id: "description",
            title: PRODUCT_SECTION_TITLES.description,
            content: (
              <ProductDescriptionSection
                // 段は到達したものだけが mount される（`WizardForm` の `reached`）。ここへ
                // 来た時点で開かれているので、編集面を待たせる理由が無い。
                active={true}
                idPrefix={idPrefix}
                initialValue={initialValues.description}
                onValueChange={changeDescription}
                value={values.values.description}
              />
            ),
          },
          {
            id: "images",
            title: PRODUCT_SECTION_TITLES.images,
            // 送れなかった枚を残したまま先へ進ませない。載らないのは送信に載らない枚だけで、
            // 気づく手立てが画像の段にしか無い。
            blocked: images.uploading || images.failed,
            content: (
              <ProductImagesSection
                idPrefix={idPrefix}
                images={images}
                maxUploadBytes={maxUploadBytes}
                onReject={rejection.onReject}
                rejection={rejection.rejection}
              />
            ),
          },
          {
            id: "publish",
            title: PRODUCT_SECTION_TITLES.publish,
            blocked: values.isSectionBlocked("publish"),
            nextLabel: "確認",
            content: (
              <ProductPublishSection
                form={values}
                idPrefix={idPrefix}
                statusOptions={statusOptions}
              />
            ),
          },
          {
            id: "confirm",
            title: "確認",
            content: (
              <ProductConfirmSection
                categoryOptions={categoryOptions}
                imageCount={images.imagePaths.length}
                statusOptions={statusOptions}
                values={values.values}
              />
            ),
          },
        ]}
        submit={
          <ProductSubmitButton
            blocked={images.uploading || images.failed}
            label="登録する"
            pendingLabel="登録しています…"
          />
        }
      />
    </form>
  );
}

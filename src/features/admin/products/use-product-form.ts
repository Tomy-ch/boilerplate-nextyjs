"use client";

import { useUnsavedChanges } from "../ui/unsaved-changes-guard/unsaved-changes-guard";
import type { ProductFormState, UploadProductImageAction } from "./form-state";
import { useActionResultFreshness } from "./use-action-result-freshness";
import type { ImageRejection } from "./use-image-rejection";
import { useImageRejection } from "./use-image-rejection";
import type { ProductImages, ProductSavedImage } from "./use-product-images";
import { useProductImages } from "./use-product-images";
import type { ProductFormValues, ProductValues } from "./use-product-values";
import { useProductValues } from "./use-product-values";

/** 商品のフォームが持つ状態のひとまとまり。 */
export type ProductForm = {
  /** 入力の値と、その判定。 */
  readonly values: ProductFormValues;
  /** 選択中の画像と、その動かし方。 */
  readonly images: ProductImages;
  /** 送る前に弾かれたファイルの文言。 */
  readonly rejection: ImageRejection;
  /** 直前の送信の結果を、もう出さないか。 */
  readonly dismissed: boolean;
  /** 直前の送信の結果を下げる。 */
  readonly dismiss: () => void;
  /**
   * この描画で送信の結果が入れ替わったか。
   *
   * @remarks
   * **描画のあいだだけ真になる合図**で、状態ではありません。読むのは描画の本体で、その描画の
   * うちに何を起こすかを決めます（誤りのある観点へ移る、など）。落ち着いた後は偽に戻るため、
   * 後から読み直しても入れ替わりは判りません。
   */
  readonly resultIsNew: boolean;
};

/** {@link useProductForm} に渡すもの。 */
export type ProductFormInput = {
  /** 開いた時点の値。 */
  readonly initialValues: ProductValues;
  /** 在庫数を尋ねるか。作る時だけ尋ね、編集では別の口が持つ。 */
  readonly withQuantity: boolean;
  /** 受け付ける 1 枚あたりの大きさ（byte）。 */
  readonly maxUploadBytes: number;
  /** 画像を送る送信先。 */
  readonly uploadAction: UploadProductImageAction;
  /** 読み込んだ時点で保存されている画像。作る画面では空。 */
  readonly savedImages?: readonly ProductSavedImage[];
  /** 直前の送信の結果。入れ替わりを見るために受け取る。 */
  readonly state: ProductFormState;
};

/**
 * 商品のフォームが持つ状態を、作る画面と編集の画面で同じ形に揃える。
 *
 * @remarks
 * **同じ状態の組み立てが 2 つの画面で要るため、hook にしています。** 器（段階 / 観点）と送信先は
 * 画面ごとに違いますが、何を覚えていて何を書き換えられるかは同じです。
 *
 * **書きかけの申告もここが持ちます。**判定に使うのは入力の差分と画像の顔ぶれで、どちらもここに
 * あります。画面の側へ出すと、画面ごとに数え方がずれます。
 *
 * 送信そのもの（`useActionState`）は持ちません。送信先が画面ごとに違い、戻り先も別のためです。
 * 結果だけを受け取り、**入れ替わったかどうか**を返します。入れ替わりに何を起こすかは画面が
 * 決めます（誤りのある観点へ移る、など）。
 */
export function useProductForm({
  initialValues,
  maxUploadBytes,
  savedImages,
  state,
  uploadAction,
  withQuantity,
}: ProductFormInput): ProductForm {
  const values = useProductValues(initialValues, { withQuantity });
  const images = useProductImages(uploadAction, savedImages);
  const rejection = useImageRejection(maxUploadBytes);
  const { dismissed, dismiss, resultIsNew } = useActionResultFreshness(state);

  useUnsavedChanges(values.dirty || images.dirty);

  return { values, images, rejection, dismissed, dismiss, resultIsNew };
}

"use server";

import { redirect } from "next/navigation";
import {
  adjustProductStock,
  createProduct,
  updateProduct,
  uploadProductImage,
} from "@/adapters/server/api/products";
import { verifySession } from "@/adapters/server/auth/session";
import { MAX_UPLOAD_BYTES } from "@/config/http/http.client";
import { createAppError, findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { ADMIN_PRODUCT_LIST_PATH } from "@/features/admin/paths";
import {
  PRODUCT_IMAGE_ACCEPT,
  PRODUCT_IMAGE_ACCEPT_LABEL,
} from "@/features/admin/products/field-limits";
import { PRODUCT_FORM_NAMES } from "@/features/admin/products/form-names";
import type {
  ProductFormState,
  ProductImageUploadState,
} from "@/features/admin/products/form-state";
import { PRODUCT_VERSION_CONFLICT_MESSAGE } from "@/features/admin/products/form-state";
import {
  parseProductDraftForm,
  parseProductEditForm,
} from "@/features/admin/products/parse-product-form";
import type { StockFormState } from "@/features/admin/products/stock/form-state";
import { parseStockForm } from "@/features/admin/products/stock/parse-stock-form";
import {
  actionStateFromError,
  failedActionState,
  succeededActionState,
} from "@/model/action-state";
import { isAdmin } from "@/model/authz";
import { toProductId } from "@/model/product/product";

const INVALID_INPUT_MESSAGE = "入力内容を確認してください。";

const MISSING_IMAGE_MESSAGE = "画像が選ばれていません。";
const UNSUPPORTED_IMAGE_MESSAGE = `${PRODUCT_IMAGE_ACCEPT_LABEL} のいずれかを選んでください。`;
const OVERSIZED_IMAGE_MESSAGE = "画像が大きすぎます。もっと小さいものを選んでください。";

/** 役割を持たない主体の要求をここで止める。 */
async function assertAdmin(): Promise<void> {
  if (!isAdmin(await verifySession())) {
    throw createAppError(ErrorKind.PERMISSION_DENIED, {
      cause: new Error("管理の操作に必要な役割がありません"),
    });
  }
}

/**
 * 画像を 1 件アップロードする。
 *
 * @remarks
 * 主体の断言が要る action なので、この層に置きます（[同層の README](../../README.md)）。画面の側は
 * 送信先を受け取るだけです。
 *
 * **画面から受け取った時点でもう一度確かめます。** 送る前の判定はブラウザ側にあり、
 * 送信者が差し替えられます。署名付き URL の経路なら署名ポリシーが担っていた層がここには無いため、
 * この段が最後の砦です。
 *
 * 形式は宣言された `type` で見ます。これは送信者が付けられる値なので、中身がその形式である
 * ことまでは保証しません。中身の判定は保存する側が持ちます。
 */
export async function uploadProductImageAction(
  _previous: ProductImageUploadState,
  formData: FormData,
): Promise<ProductImageUploadState> {
  try {
    await assertAdmin();
  } catch (error) {
    return actionStateFromError(error);
  }

  const image = formData.get(PRODUCT_FORM_NAMES.images);

  if (!(image instanceof File) || image.size === 0) {
    return failedActionState({ formError: MISSING_IMAGE_MESSAGE });
  }

  if (!PRODUCT_IMAGE_ACCEPT.split(",").includes(image.type)) {
    return failedActionState({ formError: UNSUPPORTED_IMAGE_MESSAGE });
  }

  if (image.size > MAX_UPLOAD_BYTES) {
    return failedActionState({ formError: OVERSIZED_IMAGE_MESSAGE });
  }

  try {
    return succeededActionState(await uploadProductImage(image));
  } catch (error) {
    return actionStateFromError(error);
  }
}

/**
 * 商品を作る。
 *
 * @remarks
 * 成立したら一覧へ送ります。作った直後に同じ空のフォームへ留まると、続けて押したときに同じ
 * 商品をもう 1 件作れてしまいます。
 */
export async function createProductAction(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    await assertAdmin();
  } catch (error) {
    return actionStateFromError(error);
  }

  const parsed = parseProductDraftForm(formData);

  if (!parsed.ok) {
    // 項目ごとの誤りがあるときは全体の文言を出さない。要約が同じことを言うため、同じ指摘が
    // 2 か所に並ぶ。
    return failedActionState({ formError: null, fieldErrors: parsed.fieldErrors });
  }

  try {
    await createProduct(parsed.value);
  } catch (error) {
    return actionStateFromError(error);
  }

  redirect(ADMIN_PRODUCT_LIST_PATH);
}

/**
 * 商品を更新する。
 *
 * @remarks
 * `409` にだけ専用の文言を当てます。カタログの既定文言は分類だけを伝えるもので、拒まれた理由が
 * 「読み込んでからの間に別の人が更新した」ことであるのは、この画面でしか言えません。
 */
export async function updateProductAction(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    await assertAdmin();
  } catch (error) {
    return actionStateFromError(error);
  }

  const id = formData.get("id");
  const parsed = parseProductEditForm(formData);

  if (!parsed.ok) {
    return failedActionState({
      formError: parsed.formError ?? null,
      fieldErrors: parsed.fieldErrors,
    });
  }

  if (typeof id !== "string" || id === "") {
    return failedActionState({ formError: INVALID_INPUT_MESSAGE });
  }

  try {
    await updateProduct(toProductId(id), parsed.value);
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.CONFLICT) {
      return failedActionState({
        formError: PRODUCT_VERSION_CONFLICT_MESSAGE,
        kind: ErrorKind.CONFLICT,
      });
    }

    return actionStateFromError(error);
  }

  redirect(ADMIN_PRODUCT_LIST_PATH);
}

/**
 * 在庫を動かす。
 *
 * @remarks
 * 送るのは増減量だけです。他の項目を一緒に受け取らないのは、在庫と他の項目で更新の仕方が違い
 * （加算と書き戻し）、1 つの送信に混ぜると片方の作法に引きずられるためです。
 *
 * 成立したら一覧へ送ります。連続して補充するときは一覧を経由します。同じ画面に留まると、
 * 押し直しがそのまま二重の加算になり、しかも成立した後なので取り消す手段がありません。
 */
export async function adjustProductStockAction(
  _previous: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  try {
    await assertAdmin();
  } catch (error) {
    return actionStateFromError(error);
  }

  const parsed = parseStockForm(formData);

  if (!parsed.ok) {
    return failedActionState({ formError: parsed.formError, fieldErrors: parsed.fieldErrors });
  }

  try {
    await adjustProductStock(parsed.productId, parsed.delta);
  } catch (error) {
    return actionStateFromError(error);
  }

  redirect(ADMIN_PRODUCT_LIST_PATH);
}

import type { ActionState } from "@/model/action-state";

/**
 * 商品のフォームが持つ項目。
 *
 * @remarks
 * 項目ごとの文言を配る宛先です。文字列そのままではなく union で持つのは、項目名を変えたときに
 * 送る側と受ける側が別々に古くなるのを型で止めるためです。
 *
 * 在庫数は作成のときだけ現れます。編集では別の口が持つためで、送られてきても捨てます。
 */
export type ProductFormField =
  | "name"
  | "description"
  | "price"
  | "quantity"
  | "stockWarningThreshold"
  | "categoryId"
  | "statusId"
  | "publishedAt"
  | "images";

/**
 * 商品のフォームの結果。
 *
 * @remarks
 * 成功値を持ちません。作成も更新も、成立したら一覧へ送るためです。
 */
export type ProductFormState = ActionState<void, ProductFormField>;

/**
 * アップロードした画像のオブジェクトキー。
 *
 * @remarks
 * 成功値を持つのは、返ってきたキーを画面が form へ載せ直すためです。作成・更新の送信に載るのは
 * ファイルそのものではなく、このキーの並びです。
 */
export type ProductImageUploadState = ActionState<string>;

/**
 * 商品を作る送信先。
 *
 * @remarks
 * **この画面は送信先を自分で決めません。** 役割の確認は `adapters/server/auth` の領分で、そこへ
 * 触れてよいのは app 層です（`architecture.ts` の `adapters-auth`）。したがって送信先は route が
 * 渡します。
 */
export type CreateProductAction = (
  state: ProductFormState,
  formData: FormData,
) => Promise<ProductFormState>;

/** 商品を更新する送信先。渡される理由は {@link CreateProductAction} と同じ。 */
export type UpdateProductAction = CreateProductAction;

/** 画像を送る送信先。渡される理由は {@link CreateProductAction} と同じ。 */
export type UploadProductImageAction = (
  state: ProductImageUploadState,
  formData: FormData,
) => Promise<ProductImageUploadState>;

/**
 * 版そのものが送られてこなかったときの文言。
 *
 * @remarks
 * {@link PRODUCT_VERSION_CONFLICT_MESSAGE} と別にするのは、起きたことが違うためです。競合は
 * 「他の人が先に更新した」で、こちらは「画面が版を運べていない」。読み込み直す導線を添えるのは
 * 競合の側だけで、こちらは開き直してもらうしかありません。
 */
export const PRODUCT_VERSION_LOST_MESSAGE =
  "編集の前提が失われています。画面を開き直してください。";

/**
 * 版が食い違って拒まれたときの文言。
 *
 * @remarks
 * 送る側（Server Action）だけが使います。画面はこの文言を合図にしないため、文言は自由に
 * 変えてよい（合図は結果に載る分類）。
 */
export const PRODUCT_VERSION_CONFLICT_MESSAGE =
  "この商品は別の人が更新しました。読み込み直して、最新の内容に対して編集し直してください。";

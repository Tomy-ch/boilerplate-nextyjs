import type { FieldErrors } from "@/model/action-state";
import type { ProductDraft, ProductEdit, ProductImageDraft } from "@/model/product/product";

import { PRODUCT_FORM_NAMES } from "./form-names";
import { PRODUCT_VERSION_LOST_MESSAGE, type ProductFormField } from "./form-state";
import type { ProductValidatedField } from "./product-rules";
import { PRODUCT_COMMON_VALIDATED_FIELDS, PRODUCT_FIELD_RULES } from "./product-rules";

/** 読み取りの結果。読めた場合だけ値を持つ。 */
export type ProductFormParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly fieldErrors: FieldErrors<ProductFormField>;
      /** 項目に紐づかない失敗。フォーム全体の前提が崩れているときだけ付く。 */
      readonly formError?: string;
    };

/** 空欄を undefined として読む。form は未入力を空文字として送るため。 */
function readText(form: FormData, key: string): string | undefined {
  const value = form.get(key);

  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  return trimmed === "" ? undefined : trimmed;
}

/**
 * 画像の一覧を読む。
 *
 * @remarks
 * 表示順は**送られてきた並びそのもの**です。画面が並べ替えた結果がその並びであり、番号を別の欄で
 * 受け取ると、並びと番号のどちらが正かが決まりません。
 */
function readImages(form: FormData): readonly ProductImageDraft[] {
  return form
    .getAll(PRODUCT_FORM_NAMES.images)
    .filter((value): value is string => typeof value === "string" && value !== "")
    .map((imagePath, index) => ({ imagePath, displaySort: index + 1 }));
}

/**
 * 入力された日時を、瞬間へ確定させる。
 *
 * @remarks
 * `datetime-local` が運ぶのは時差を持たない壁時計の値です。これをそのまま `new Date` に掛けると
 * **実行環境の時差**で解釈され、配備先（多くは UTC）と入力した人の時差の差ぶんだけずれます。
 * どちらの時差で読むべきかは入力した本人の側にしか無いため、同じ form で運んだ値を使います。
 *
 * 時差が運ばれてこなかったときは確定できないので、瞬間を作らずに捨てます。既定の時差へ倒すと、
 * ずれた日時が正しい値として保存されます。
 */
function toInstant(wallClock: string, offsetMinutes: number | undefined): Date | undefined {
  if (offsetMinutes === undefined) return undefined;

  const wall = Date.parse(`${wallClock}Z`);

  if (Number.isNaN(wall)) return undefined;

  return new Date(wall + offsetMinutes * 60_000);
}

/** 入力した人の時差を分で読む。`getTimezoneOffset()` と同じ符号（UTC より東は負）。 */
function readTimezoneOffset(form: FormData): number | undefined {
  const raw = readText(form, PRODUCT_FORM_NAMES.timezoneOffset);

  if (raw === undefined) return undefined;

  const value = Number(raw);

  return Number.isInteger(value) && Math.abs(value) <= 16 * 60 ? value : undefined;
}

/**
 * 版を読む。
 *
 * @remarks
 * 版は利用者が入力する項目ではないため、形の上での判定を持つ項目の一覧には入りません。読めない
 * ときは「編集の前提が失われた」であって、直せる入力の誤りではありません。
 */
function readVersion(form: FormData): number | undefined {
  const raw = readText(form, PRODUCT_FORM_NAMES.version);

  if (raw === undefined) return undefined;

  const value = Number(raw);

  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** 共通部分の読み取りと、そこで見つかった誤り。 */
type CommonFields = {
  readonly draft: Omit<ProductDraft, "quantity">;
  readonly fieldErrors: Record<string, readonly string[]>;
};

/** 判定を掛けずに、項目の値だけを読む。 */
function read(form: FormData, field: ProductValidatedField): string {
  const raw = form.get(PRODUCT_FORM_NAMES[field]);

  return (typeof raw === "string" ? raw : "").trim();
}

/**
 * 1 項目を読み、形の上での判定に掛ける。
 *
 * @remarks
 * **判定と文言は {@link PRODUCT_FIELD_RULES} が持ちます。**同じ判定を画面の側も通るため、ここへ
 * 書き写すと同じ誤りに 2 通りの言い方が生まれ、片方だけを直せます。
 */
function check(
  form: FormData,
  field: ProductValidatedField,
  fieldErrors: Record<string, readonly string[]>,
): string {
  const raw = form.get(PRODUCT_FORM_NAMES[field]);
  const value = typeof raw === "string" ? raw : "";
  const message = PRODUCT_FIELD_RULES[field](value);

  if (message !== undefined) fieldErrors[field] = [message];

  return value.trim();
}

function parseCommon(form: FormData): CommonFields {
  const fieldErrors: Record<string, readonly string[]> = {};

  // 判定は名簿を回して掛ける。1 件ずつ書き並べると、項目を足したときに書き漏らした項目だけが
  // 判定を通らずに素通しする。値の写し方は項目ごとに違うので、そちらは下で個別に読む。
  for (const field of PRODUCT_COMMON_VALIDATED_FIELDS) check(form, field, fieldErrors);

  const name = read(form, "name");
  const price = read(form, "price");
  const categoryId = read(form, "categoryId");
  const statusId = read(form, "statusId");
  const threshold = read(form, "stockWarningThreshold");
  const publishedAt = read(form, "publishedAt");
  // 形として読めないことは規則が既に言っている。重ねて言うと、同じ項目に 2 つの文言が並ぶ。
  const instant =
    publishedAt === "" || fieldErrors["publishedAt"] !== undefined
      ? null
      : toInstant(publishedAt, readTimezoneOffset(form));

  if (instant === undefined) {
    fieldErrors["publishedAt"] = [
      ...(fieldErrors["publishedAt"] ?? []),
      "公開日時を確定できませんでした。入力し直してください。",
    ];
  }

  return {
    draft: {
      name,
      description: readText(form, PRODUCT_FORM_NAMES.description) ?? null,
      price,
      stockWarningThreshold: threshold === "" ? null : Number(threshold),
      categoryId,
      statusId,
      publishedAt: instant ?? null,
      images: readImages(form),
    },
    fieldErrors,
  };
}

/**
 * 作成のフォームを読む。
 *
 * @remarks
 * 検証をここに置くのは、**送信の編成と入力の読み取りを分ける**ためです。ここが持つのは form の
 * 綴りと、利用者へ返す文言までで、業務としての妥当性は backend が決めます。
 */
export function parseProductDraftForm(form: FormData): ProductFormParseResult<ProductDraft> {
  const { draft, fieldErrors } = parseCommon(form);

  const quantity = check(form, "quantity", fieldErrors);

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, value: { ...draft, quantity: Number(quantity) } };
}

/**
 * 編集のフォームを読む。
 *
 * @remarks
 * 版を必ず要求します。読み込んだ時点の版が無いまま送ると、その間の他者の更新を黙って消します。
 */
export function parseProductEditForm(form: FormData): ProductFormParseResult<ProductEdit> {
  const { draft, fieldErrors } = parseCommon(form);

  const version = readVersion(form);

  // 版が無いまま先へ進ませない。既定値へ倒すと、読み込んでいない版で他者の更新を上書きする。
  // これは項目の誤りではないので、項目へ相乗りさせない。相乗りさせると要約がその項目の名前を
  // 前置きし、直しようのない入力欄を指す導線が出る。
  if (version === undefined) {
    return { ok: false, fieldErrors, formError: PRODUCT_VERSION_LOST_MESSAGE };
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, value: { ...draft, version } };
}

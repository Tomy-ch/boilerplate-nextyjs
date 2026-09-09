import type { ReactNode } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../../design-system/form/field/field";
import { toDescriptionId, toErrorId } from "../../design-system/form/field/field.definition";
import { RequirementBadge } from "../../design-system/form/requirement-badge/requirement-badge";
import { type FieldControlAttributes, fieldControlAttributes } from "./field-attributes";

/** {@link FormField} の props。 */
export type FormFieldProps = {
  /**
   * 入力欄を組み立てる。渡される属性をそのまま入力欄へ広げる。
   *
   * @remarks
   * **受け取る形にしてあるのは、付け忘れを起こせなくするためです。** 呼び出し元に組ませると、
   * `FormField` だけを使って属性を通さない画面が書けてしまいます。何を与えるかは
   * `fieldControlAttributes` が 1 か所で決めます。
   */
  children: (control: FieldControlAttributes) => ReactNode;
  /** 入力欄の `id`。label の `htmlFor` が指し、誤りと補足の `id` もここから導く。 */
  controlId: string;
  /** 項目の名前。 */
  label: string;
  /** 誤りの文言。無ければ誤りは描画しない。 */
  message?: string;
  /**
   * 入力の補足。誤りとは別に常時出す。
   *
   * @remarks
   * 入力欄の `aria-describedby` が指せるよう `id` を付けて描画する。**指すのは呼び出し元**なので、
   * ここへ渡した補足は `fieldControlAttributes` へも渡す。
   */
  description?: string;
  /** 空欄を受け付けない項目か。 */
  required: boolean;
};

/**
 * 項目名・入力欄・補足・誤りを 1 つの組にまとめる外枠。
 *
 * @remarks
 * 入力欄そのものは受け取らず、children として差し込む。text / select / 独自の合成のいずれでも
 * 同じ外枠を使えるようにするためで、入力欄の種類ごとに外枠を作ると、誤りの位置も必須の印の
 * 位置も種類ごとにずれていく。
 *
 * **`id` を生成しない。** 同じフォームを 1 つの文書へ 2 度置いたときに重複するため、生成は
 * `useId()` を持てる呼び出し元が行う。ここは受け取った `id` から誤りと補足の `id` を導き、
 * label と入力欄へ配る。
 *
 * **入力欄の `aria-*` は、children へ渡して呼び出し元に広げてもらう。** 入力欄そのものは
 * 受け取らないので直接は触れないが、**何を与えるかはここが決める**（理由は
 * {@link FormFieldProps.children}）。
 *
 * 検証も、必須かどうかの判定も持たない。どちらも呼び出し元が検証スキーマから導いて渡す。
 *
 * @example
 * ```tsx
 * <FormField controlId={id} label="姓" message={error} required>
 *   {(control) => <Input {...control} {...register("lastName")} />}
 * </FormField>
 * ```
 *
 * @see Storybook `Form/FormField`
 */
export function FormField({
  children,
  controlId,
  description,
  label,
  message,
  required,
}: FormFieldProps) {
  const errorId = toErrorId(controlId);

  return (
    <Field data-invalid={message !== undefined}>
      <div className="flex items-center gap-2">
        <RequirementBadge required={required} />
        <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      </div>
      {children(fieldControlAttributes({ controlId, description, errorId, message, required }))}
      {description === undefined ? null : (
        <FieldDescription id={toDescriptionId(controlId)}>{description}</FieldDescription>
      )}
      {message === undefined ? null : <FieldError id={errorId}>{message}</FieldError>}
    </Field>
  );
}

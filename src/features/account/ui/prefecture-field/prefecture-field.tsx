"use client";

import {
  SelectNative,
  SelectNativeOption,
} from "@/components/design-system/form/select-native/select-native";
import { FormField } from "@/components/patterns/form-field/form-field";
import type { Prefecture } from "@/model/user/user";
import type { ProfileFieldProps } from "../../use-profile-fields";

type PrefectureFieldProps = ProfileFieldProps & {
  readonly prefectures: readonly Prefecture[];
};

/**
 * 都道府県の項目。
 *
 * @remarks
 * 入力欄が `Input` ではなく `SelectNative` になるだけで、`TextField` と配線の規則は変わりません。
 *
 * 検索つきの client island を使いません。契約が全 47 件を固定で返す静的な候補なので、
 * 持ち込む理由がありません。
 */
export function PrefectureField({
  controlId,
  message,
  prefectures,
  registration,
  required,
}: PrefectureFieldProps) {
  return (
    <FormField controlId={controlId} label="都道府県" message={message} required={required}>
      {(control) => (
        <SelectNative {...control} autoComplete="address-level1" {...registration}>
          {prefectures.map((option) => (
            <SelectNativeOption key={option.id} value={option.name}>
              {option.name}
            </SelectNativeOption>
          ))}
        </SelectNative>
      )}
    </FormField>
  );
}

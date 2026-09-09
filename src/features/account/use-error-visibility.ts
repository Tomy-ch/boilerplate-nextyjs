"use client";

import { useState } from "react";

/** {@link useErrorVisibility} が返すもの。 */
export type ErrorVisibility<TField extends string> = {
  /**
   * 実際に出す文言を決める。
   *
   * @param field - 対象の項目
   * @param current - 検証の結果。誤りが無ければ undefined
   */
  readonly visible: (field: TField, current: string | undefined) => string | undefined;
  /**
   * focus の出入りを掴む handler を組む。
   *
   * @param field - 対象の項目
   * @param current - その時点の検証の結果。焦点を当てた瞬間の値を控えるのに使う
   */
  readonly track: (
    field: TField,
    current: string | undefined,
  ) => { readonly onFocus: () => void; readonly onBlur: () => void };
};

/**
 * 誤りをいつ見せるかだけを決める。
 *
 * @remarks
 * **検証しません。** 検証の結果を受け取り、それを出すか伏せるかだけを決めます。どの値が正しいかは
 * スキーマが、いつ検証するかはフォームの機構が持ちます。
 *
 * 規則は reward early, punish late です。focus が当たっている項目では、
 * **焦点を当てた時点に出ていた文言を上限にします**。直れば消え、直っていなければ文言は
 * 変わりません。上限が無いと、書き直そうとして 1 文字消しただけで「入力してください」が現れます。
 *
 * 項目名の型だけを受け取り、フォームの実装（react-hook-form など）を知りません。規則は repo 全体の
 * ものなので、機構が変わっても残ります。
 */
export function useErrorVisibility<TField extends string>(): ErrorVisibility<TField> {
  // 編集中の項目と、焦点を当てた時点に出ていた文言。1 つの値にするのは、片方だけが残ると
  // 別の項目の文言を上限に使ってしまうためである。
  const [editing, setEditing] = useState<{
    readonly field: TField;
    readonly messageAtFocus: string | undefined;
  } | null>(null);

  return {
    visible: (field, current) => {
      if (editing?.field !== field || current === undefined) {
        return current;
      }

      return editing.messageAtFocus;
    },
    track: (field, current) => ({
      // 焦点を当てた時点の文言を控えるのはここ。描画からは読めない。
      onFocus: () => setEditing({ field, messageAtFocus: current }),
      onBlur: () => setEditing(null),
    }),
  };
}

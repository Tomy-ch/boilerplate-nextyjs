"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { SearchFieldClient } from "@/components/design-system/form/search-field-client/search-field-client";
import { SEARCH_FIELD_COMMIT } from "@/components/design-system/form/search-field-client/search-field-client.definition";

import { type AdminProductListConditions, toConditionHref } from "../../query";

/** `AdminProductKeywordField` の props。 */
export type AdminProductKeywordFieldProps = {
  /** いま効いている条件。押しても結果が変わらないかの判断と、飛び先の組み立てに使う。 */
  conditions: AdminProductListConditions;
};

/**
 * 管理側の商品一覧の検索欄。
 *
 * @remarks
 * **打鍵では検索しません。** 一覧はページ送りで見る前提なので、打鍵のたびに取り直すと、読んでいる
 * 途中で行が入れ替わります。分類と状態は候補から選ぶ操作で選び終わりが判るため、確定の契機が違います。
 *
 * 入力の保持はこの欄自身が持ちます。まとめて確定する条件が他に無いためで、確定した検索語は URL が
 * 持ちます（[0060](../../../../../../../docs/adr/0060-state-management.md)）。
 *
 * **URL の変化を「自分が送ったもの」と「外から来たもの」で区別します。** 外から来た変化
 * （chip の解除）でだけ下書きを揃えます。区別しない場合に何が起きるかは
 * [0060](../../../../../../../docs/adr/0060-state-management.md)。
 *
 * **空のまま押せるのは、いま検索語が効いているときだけです。** 効いている検索語を消すには空の
 * 送信が要る一方、何も効いていない状態での送信は結果が変わりません。
 *
 * @see Storybook `Features/Admin/Products/List/KeywordField`
 */
export function AdminProductKeywordField({ conditions }: AdminProductKeywordFieldProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(conditions.keyword);
  const [seen, setSeen] = useState(conditions.keyword);
  const [sent, setSent] = useState<string | null>(null);

  if (seen !== conditions.keyword) {
    setSeen(conditions.keyword);

    if (sent === conditions.keyword) {
      setSent(null);
    } else {
      setDraft(conditions.keyword);
    }
  }

  const search = useCallback(
    (value: string) => {
      const keyword = value.trim();

      setSent(keyword);
      router.push(toConditionHref({ ...conditions, keyword }));
    },
    [conditions, router],
  );

  return (
    <SearchFieldClient
      className="max-w-xs flex-1"
      commit={SEARCH_FIELD_COMMIT.SUBMIT}
      label="商品名で探す"
      onSearch={search}
      onValueChange={setDraft}
      placeholder="商品名で探す"
      submitDisabled={draft.trim() === "" && conditions.keyword === ""}
      value={draft}
    />
  );
}

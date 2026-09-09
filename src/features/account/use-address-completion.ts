"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAddresses } from "@/adapters/client/api/addresses";
import type { AddressCandidate } from "@/model/user/user";

/**
 * 直近の補完の結果。画面はこれを読み上げ用の文言へ写す。
 *
 * @remarks
 * 進行中であることは含めません。取得の間だけ別の値へ移ると、応答が速いときに結果の文言が
 * 消えて戻り、文字が明滅します。進行中かどうかは {@link useAddressCompletion} が別に返します。
 *
 * 候補が無い場合を 2 つに分けます。`empty` は該当する住所が無かっただけで、郵便番号を直せば
 * 埋まります。`unavailable` は lookup 機構そのものが動いておらず、何度引いても埋まりません。
 * 画面が利用者へ言うべきことが変わるため、同じ「埋まらなかった」で畳みません。
 */
export type AddressCompletionResult = "idle" | "filled" | "empty" | "unavailable";

/** 補完で埋める値。候補が割れた項目は持たない。 */
export type AddressCompletion = {
  readonly prefecture?: string;
  readonly city?: string;
  readonly town?: string;
};

/**
 * すべての候補で一致する値だけを返す。割れていれば undefined。
 *
 * @remarks
 * 1 つの郵便番号が複数の町域を指すことがあります。候補の先頭を無条件に採ると、利用者が
 * 選んでいない住所が黙って入ります。全部が同じなら選ぶ余地が無いので、そこだけ埋めます。
 */
function agreedValue(
  candidates: readonly AddressCandidate[],
  pick: (candidate: AddressCandidate) => string,
): string | undefined {
  const values = new Set(candidates.map(pick));

  return values.size === 1 ? values.values().next().value : undefined;
}

/**
 * 郵便番号から住所を補完する。
 *
 * @remarks
 * 引けなかったときは何も埋めません。補完は入力を助けるためのもので、外部の lookup が落ちても
 * 手入力で先へ進めます。
 *
 * 前の取得は打ち切ります。郵便番号を続けて直すと、遅れて返った古い応答が新しい入力を
 * 上書きします。
 *
 * 同じ郵便番号では 2 度引きません。補完は focus が外れるたびに走るため、値を変えずに項目を
 * 通り過ぎただけでも要求が出ます。埋め直しても結果は同じで、見つからなかった旨の文言だけが
 * 触っていない項目に対して現れます。
 *
 * **操作で呼ばれたときは引き直します**（`force`）。利用者が押した操作が何も起こさないと、
 * 壊れていると読まれます。
 *
 * @param onCompleted - 埋める値を受け取る。フォームへの反映は呼び出し側が持つ
 */
export function useAddressCompletion(onCompleted: (completion: AddressCompletion) => void) {
  const [result, setResult] = useState<AddressCompletionResult>("idle");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastPostalCodeRef = useRef<string | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const complete = useCallback(
    async (postalCode: string, { force = false }: { force?: boolean } = {}) => {
      if (!force && lastPostalCodeRef.current === postalCode) {
        return;
      }

      lastPostalCodeRef.current = postalCode;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      const { candidates, isFallback } = await fetchAddresses(postalCode, controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      setLoading(false);

      if (candidates.length === 0) {
        setResult(isFallback ? "unavailable" : "empty");

        return;
      }

      onCompleted({
        prefecture: agreedValue(candidates, (candidate) => candidate.prefecture),
        city: agreedValue(candidates, (candidate) => candidate.city),
        town: agreedValue(candidates, (candidate) => candidate.town),
      });
      setResult("filled");
    },
    [onCompleted],
  );

  return { complete, loading, result };
}

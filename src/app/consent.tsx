"use client";

import type { ReactNode } from "react";

import { ConsentBanner } from "@/components/shell/consent-banner/consent-banner";
import { allowsCategory, CONSENT_CATEGORY, shouldAskConsent } from "@/model/consent";
import { decideConsent, useConsentState } from "@/stores/consent-store";

/**
 * 判断の材料として示す文書の行き先。
 *
 * @remarks
 * 器が持ちます。部品へ焼くと、文書を別の場所へ置いたときに部品側を
 * 書き換えることになります。
 */
const POLICY_HREF = "/privacy";

/**
 * 同意を尋ね、同意を要する資材をその裏に置く島。
 *
 * @remarks
 * root layout が一度だけ mount します。**尋ねる面とゲートを 1 つにまとめます** —— どちらも同じ
 * 同意状態を見ており、別々に置くと購読が 2 つになり、選んだ直後に片方だけが反応する瞬間が
 * できます。
 *
 * **`children` に渡すのは、同意が無ければ読み込んではならないものだけです。** 未同意の間は
 * 描画しないので、DOM にも要素が現れません。属性で無効にする形にすると、要素が存在する時点で取得が
 * 始まる資材を止められません。
 *
 * **何を裏へ置き、何を置かないかは器が決めます** —— 本体は何も繋がず、運用テレメトリも通しません
 * （`docs/spec/route/layout.function.md`「同意が無いものは読み込まない」）。
 *
 * @param props.children - 同意が得られている間だけ描く資材
 */
export function Consent({ children }: Readonly<{ children?: ReactNode }>) {
  const state = useConsentState();

  return (
    <>
      <ConsentBanner
        onDecide={decideConsent}
        open={shouldAskConsent(state)}
        policyHref={POLICY_HREF}
      />
      {allowsCategory(state, CONSENT_CATEGORY.optional) ? children : null}
    </>
  );
}

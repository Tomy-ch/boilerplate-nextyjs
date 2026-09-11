import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { ABOUT_PATH, PRIVACY_PATH } from "@/features/site-info/facade/paths/paths";
import { withPartSpan } from "@/observability/render-span";
import { WithdrawButton } from "../withdraw-button/withdraw-button";

/**
 * 戻せない操作と外部への導線を、読むための内容から切り離して置く並び。
 *
 * @remarks
 * 退会は戻せない操作なので、情報を確かめに来た視線の流れの中に入れません。一方で隠しもしません。
 * 探し回る形にすると、退会したい利用者が問い合わせでしか辿り着けなくなります。
 *
 * サイトの説明を同じ並びに置くのは、どちらも「この画面の内容そのものではないが、ここから
 * 辿れてほしいもの」だからです。
 *
 * 幅で並べ方を変えます。横に並べられる幅では 3 つを**同じ幅の段**に収め、収まらない幅では
 * 縦に積んで区切り線で分けます。縦に積んだだけでは、隣り合ったボタンが 1 つの群に見えて
 * 押し間違えます。区切り線は幅の判定と対で効くため、ここで持ちます。
 *
 * 幅を等分するのは、押せる範囲を揃えるためです。文言の長さで決めると「プライバシーポリシー」
 * だけが広く、退会が狭い並びになります。
 *
 * 広い画面では伸ばし切りません。ボタン 3 つが本文いっぱいまで広がると、押す場所を探して視線が
 * 端まで動きます。
 */
export const MypageActionRow = withPartSpan(
  "features/account/mypage/ui/action-row/action-row",
  () => {
    return (
      <nav
        aria-label="このサイトについての案内と退会"
        className="flex flex-col divide-y divide-border sm:grid sm:max-w-2xl sm:grid-cols-3 sm:gap-3 sm:divide-y-0"
      >
        <div className="py-3 sm:py-0">
          <Button asChild className="w-full" variant={BUTTON_VARIANT.OUTLINE}>
            <Link href={ABOUT_PATH}>このサイトについて</Link>
          </Button>
        </div>
        <div className="py-3 sm:py-0">
          <Button asChild className="w-full" variant={BUTTON_VARIANT.OUTLINE}>
            <Link href={PRIVACY_PATH}>プライバシーポリシー</Link>
          </Button>
        </div>
        <div className="flex flex-col gap-3 py-3 sm:py-0">
          <WithdrawButton />
        </div>
      </nav>
    );
  },
);

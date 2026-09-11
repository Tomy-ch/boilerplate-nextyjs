import { Separator } from "@/components/design-system/display/separator/separator";
import type { PurchaseHistoryPage } from "@/model/purchase/purchase";
import type { PurchaseSummary, UserProfile } from "@/model/user/user";
import { withScreenSpan } from "@/observability/render-span";
import { MypageActionRow } from "./ui/action-row/action-row";
import { ProfileCard } from "./ui/profile-card/profile-card";
import { PurchaseSummaryCard } from "./ui/purchase-summary-card/purchase-summary-card";

type MypageViewProps = {
  readonly profile: UserProfile;
  readonly summary: PurchaseSummary;
  readonly purchases: PurchaseHistoryPage;
};

/**
 * 読むための 2 枚を段に並べ、操作を区切りの下へ落とすマイページの器。
 *
 * @remarks
 * 操作を同じ格で並べると、情報を確かめに来た視線の流れの中に、戻せない操作が入ります。
 *
 * 段は 2 列までにします。3 列へ広げると 1 枚あたりの幅が住所や表の 1 行を折り返す幅まで縮み、
 * 広い画面のほうが読みにくくなります。
 */
export const MypageView = withScreenSpan(
  "features/account/mypage/view",
  ({ profile, purchases, summary }: MypageViewProps) => {
    return (
      <div className="flex flex-col gap-8">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <ProfileCard profile={profile} />
          <PurchaseSummaryCard purchases={purchases} summary={summary} />
        </div>
        <Separator />
        <MypageActionRow />
      </div>
    );
  },
);

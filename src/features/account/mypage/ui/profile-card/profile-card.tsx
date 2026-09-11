import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import {
  BUTTON_SIZE,
  BUTTON_VARIANT,
} from "@/components/design-system/action/button/button.definition";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/design-system/display/card/card";
import {
  KeyValueItem,
  KeyValueLabel,
  KeyValueList,
  KeyValueValue,
} from "@/components/design-system/display/key-value-list/key-value-list";
import type { UserProfile } from "@/model/user/user";
import { withPartSpan } from "@/observability/render-span";
import { PROFILE_EDIT_PATH } from "../../../paths";

/**
 * 住所を 1 つの文字列へ組む。
 *
 * @remarks
 * 郵便番号を先頭に置き、都道府県から番地までを続けます。建物名は任意入力なので、無ければ
 * その区切りごと落とします。空の要素を残すと区切り記号だけが並びます。
 */
function formatAddress(profile: UserProfile): string {
  const lines = [profile.prefecture, profile.city, profile.street, profile.building ?? ""];

  return `〒${profile.postalCode} ${lines.filter((line) => line !== "").join(" ")}`;
}

/**
 * 編集する対象と同じ場所に導線を置く、自分の登録情報のカード。
 *
 * @remarks
 * 導線を画面の下端にまとめると、何を変えに行くのかが操作の位置から読み取れなくなります。
 */
export const ProfileCard = withPartSpan(
  "features/account/mypage/ui/profile-card/profile-card",
  ({ profile }: { readonly profile: UserProfile }) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>プロフィール</CardTitle>
          <CardAction>
            <Button asChild size={BUTTON_SIZE.SMALL} variant={BUTTON_VARIANT.OUTLINE}>
              <Link href={PROFILE_EDIT_PATH}>編集する</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <KeyValueList>
            <KeyValueItem>
              <KeyValueLabel>氏名</KeyValueLabel>
              <KeyValueValue>{`${profile.lastName} ${profile.firstName}`}</KeyValueValue>
            </KeyValueItem>
            <KeyValueItem>
              <KeyValueLabel>メールアドレス</KeyValueLabel>
              {/* 契約は長さの上限を置いていないので、1 行に収まる前提を置けない。 */}
              <KeyValueValue className="break-all">{profile.email}</KeyValueValue>
            </KeyValueItem>
            <KeyValueItem>
              <KeyValueLabel>電話番号</KeyValueLabel>
              <KeyValueValue>{profile.phone}</KeyValueValue>
            </KeyValueItem>
            <KeyValueItem>
              <KeyValueLabel>住所</KeyValueLabel>
              <KeyValueValue>{formatAddress(profile)}</KeyValueValue>
            </KeyValueItem>
          </KeyValueList>
        </CardContent>
      </Card>
    );
  },
);

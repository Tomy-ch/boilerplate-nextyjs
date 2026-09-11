import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/design-system/navigation/breadcrumb/breadcrumb";
import type { Prefecture, UserProfile } from "@/model/user/user";
import { withScreenSpan } from "@/observability/render-span";
import { MYPAGE_PATH } from "../paths";
import { ProfileForm } from "./ui/profile-form/profile-form";

type ProfileEditViewProps = {
  readonly profile: UserProfile;
  readonly prefectures: readonly Prefecture[];
};

/**
 * global nav から 1 手で戻れない階層にあるため、パンくずで祖先への戻りを持つプロフィール編集の器。
 *
 * @remarks
 * nav が直接指すのはマイページまでで、ここはその下の階層にあります。
 */
export const ProfileEditView = withScreenSpan(
  "features/account/edit/view",
  ({ prefectures, profile }: ProfileEditViewProps) => {
    return (
      <div className="flex flex-col gap-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={MYPAGE_PATH}>マイページ</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>プロフィール編集</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <ProfileForm prefectures={prefectures} profile={profile} />
      </div>
    );
  },
);

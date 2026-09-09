import "server-only";

import { cache } from "react";
import type { z } from "zod";

import { getApiConfig } from "@/config/api/api.server";
import { getHttpConfig } from "@/config/http/http.server";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { getLogger } from "@/logging/logging.server";
import type { OffsetPage } from "@/model/pagination";
import type { RegistrationStatus } from "@/model/user/registration";
import type { ManagedUser, PurchaseSummary, UserId, UserProfile } from "@/model/user/user";
import { toUserId } from "@/model/user/user";

import {
  DeleteUsersDetailResponse,
  GetUsersMePurchasesSummaryResponse,
  GetUsersMeResponse,
  GetUsersQueryParams,
  GetUsersResponse,
  getUsersQueryPageMax,
  PostUsersResponse,
  PutUsersDetailResponse,
} from "../../gen/api/endpoints.zod";
import type { UserPutRequest, UsersPostRequest } from "../../gen/api/model";
import { getAccessToken, signOut, verifySession } from "../auth/session";
import { createHttpClient, type UserScopedHttpClient } from "../http/request";

type WireUser = z.infer<typeof GetUsersMeResponse>;

let client: UserScopedHttpClient | undefined;

function getClient(): UserScopedHttpClient {
  client ??= createHttpClient({
    scope: "user-scoped",
    baseUrl: getApiConfig().baseUrl,
    maxUrlBytes: getHttpConfig().maxUrlBytes,
    getBearerToken: getAccessToken,
  });

  return client;
}

/**
 * 自分の情報を契約の形のまま取る。
 *
 * @remarks
 * 外へは出しません。`id` を含むためで、これは更新と退会が対象を指すのに使う内部の識別子です。
 * 画面へ渡すと、ブラウザに置く理由の無い値がフォームの hidden や DOM に載ります。識別子は
 * この境界の内側で解決します。
 *
 * memo 化するのは、1 リクエストの中で表示と更新の双方がこれを引くためです。
 */
const getMyUser = cache(async (): Promise<WireUser> => {
  return getClient().request({ path: "/v1/users/me", schema: GetUsersMeResponse });
});

/** 契約の応答を表示用の型へ写す。 */
function toUserProfile(wire: WireUser): UserProfile {
  return {
    firstName: wire.firstName,
    lastName: wire.lastName,
    email: wire.email,
    phone: wire.phone,
    postalCode: wire.postalCode,
    prefecture: wire.prefecture,
    city: wire.city,
    street: wire.street,
    building: wire.building ?? null,
  };
}

/** 自分のプロフィールを取得する。 */
export async function getMyProfile(): Promise<UserProfile> {
  return toUserProfile(await getMyUser());
}

/**
 * 自分のプロフィールを、まだ登録していない場合を含めて取得する。
 *
 * @remarks
 * 認証を通っても、この系に利用者の記録が無い状態があります（登録前）。契約はそれを `404` で
 * 表すため、**「まだ登録していない」を例外として扱いません**。呼び出し側は登録へ促す判断を
 * するのであって、失敗を報告するのではないからです。
 *
 * `404` 以外はそのまま投げます。取得できない理由が登録前かどうかを、ここで一緒くたにすると
 * 通信障害まで「未登録」に見えます。
 *
 * @returns 未登録なら null
 */
export async function findMyProfile(): Promise<UserProfile | null> {
  try {
    return await getMyProfile();
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.NOT_FOUND) {
      return null;
    }

    throw error;
  }
}

/**
 * いま操作している主体が、利用者として登録済みかを調べる。
 *
 * @remarks
 * **session の読み取りをこの境界の内側に留めるための口です。** 確定認可は `adapters/server` が
 * 持ち、身元とトークンは外の層へ出しません。画面側が要るのは「入れるか、どちらの理由で入れないか」
 * だけなので、それだけを返します。
 *
 * 未認証を先に判定します。身元が無いまま `/v1/users/me` を叩いても `401` が返るだけで、
 * 往復が 1 つ増えます。
 */
export async function findRegistration(): Promise<RegistrationStatus> {
  if ((await verifySession()) === null) {
    return "unauthenticated";
  }

  return (await findMyProfile()) === null ? "unregistered" : "registered";
}

/**
 * 自分の購入の集計を取得する。
 *
 * @remarks
 * ステータスは ID と名称が解決済みで届くため、名称を引き直しません。
 */
export const getMyPurchaseSummary = cache(async (): Promise<PurchaseSummary> => {
  const wire = await getClient().request({
    path: "/v1/users/me/purchases/summary",
    schema: GetUsersMePurchasesSummaryResponse,
  });

  return {
    totalCount: wire.totalCount,
    totalAmount: wire.totalAmount,
    breakdown: wire.statusBreakdown.map(({ status, count, totalAmount }) => ({
      statusId: status.id,
      statusName: status.name,
      count,
      totalAmount,
    })),
  };
});

/**
 * 認証済みの主体を利用者として登録する。
 *
 * @remarks
 * 認証と利用者の登録は別物です。IdP を通った主体には身元がありますが、この系にはまだ利用者の
 * 記録がありません。ここはその記録を初めて作る口で、以後 `/v1/users/me` が引けるようになります。
 *
 * **冪等キーは呼び出し側から受け取ります。** 送信のたびに新しい鍵を作ると、二重送信は 2 人の
 * 利用者になります。鍵は「この登録という 1 つの試み」に結び付いた値でなければならず、それを
 * 知っているのは画面を開いた地点だけです。
 *
 * 鍵を渡すことで再送してよい呼び出しになるため、`idempotent` を宣言します。宣言しなければ
 * 応答が返らなかったときに再試行されず、成立したかどうかが判らないまま失敗として返ります。
 *
 * @param profile - 登録する内容
 * @param idempotencyKey - 同一の試みを指す鍵。契約は表示可能 ASCII 255 文字以内を要求する
 */
export async function registerUser(profile: UserProfile, idempotencyKey: string): Promise<void> {
  await getClient().request({
    path: "/v1/users",
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    idempotent: true,
    body: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      postalCode: profile.postalCode,
      prefecture: profile.prefecture,
      city: profile.city,
      street: profile.street,
      building: profile.building,
    } satisfies UsersPostRequest,
    schema: PostUsersResponse,
  });
}

/**
 * 自分のプロフィールを更新する。
 *
 * @remarks
 * 契約は全項目の置換（`PUT`）を要求します。部分更新の口もありますが、フォームが常に全項目を
 * 持って送るため、送った内容がそのまま更新後の状態になる形を選びます。
 *
 * @returns 更新後のプロフィール
 */
export async function updateMyProfile(profile: UserProfile): Promise<UserProfile> {
  const { id } = await getMyUser();

  const wire = await getClient().request({
    path: `/v1/users/${id}`,
    method: "PUT",
    body: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      postalCode: profile.postalCode,
      prefecture: profile.prefecture,
      city: profile.city,
      street: profile.street,
      building: profile.building,
    } satisfies UserPutRequest,
    schema: PutUsersDetailResponse,
  });

  return toUserProfile(wire);
}

/**
 * 退会し、続けて session を終わらせる。
 *
 * @remarks
 * 進行中の購入が残っていると契約は `409` を返します。呼び出し側はその分類を受けて、退会が
 * 成立しなかったことを伝えます。
 *
 * session の破棄をここに含めるのは、退会が成立した時点で手元の cookie が「消えた利用者を
 * 指す session」になるためです。残すと、無効になった身元のまま画面を回れます。
 *
 * **IdP 側を終わらせるには、返した先へ利用者を送る必要があります。** 捨てると手元の cookie が
 * 消えるだけになり、退会したはずの主体で入り直せてしまいます。
 *
 * 送り先を組み立てられなくても退会は成立として返します。cookie の破棄は先に必ず済んでおり、
 * 利用者から見た結果は変わりません。IdP に session が残ったことは運用が拾えるよう記録します。
 *
 * @returns 退会後に利用者を送り出す先。IdP が口を持たないとき、引けなかったとき null
 */
export async function withdrawMe(): Promise<string | null> {
  const { id } = await getMyUser();

  await getClient().request({
    path: `/v1/users/${id}`,
    method: "DELETE",
    schema: DeleteUsersDetailResponse,
  });

  try {
    return await signOut();
  } catch (cause) {
    getLogger().warn("退会後の IdP session 終了に失敗しました", { cause: String(cause) });

    return null;
  }
}

/**
 * 契約が受け付けるページ番号の上限。
 *
 * @remarks
 * 生成物の宣言をそのまま公開します。呼び出し側は URL から来た番号をこれに収めてから渡します
 * —— 収めずに送ると、契約の検証で弾かれて一覧の代わりにエラーの面が出ます。
 *
 * 値を書き写さないのは、契約が変わったときに写した側だけが古い上限を持ち続けるためです。生成物へ
 * 直接触れてよいのはこの層までなので（`architecture.ts` の `adapters-gen`）、外へはここが渡します。
 */
export const MANAGED_USER_PAGE_MAX: number = getUsersQueryPageMax;

/**
 * 一覧を絞り込む条件。
 *
 * @remarks
 * **1 ページの件数を呼び出し側から受け取ります。** 何件並べると読めるかは表示の判断で、
 * 外部接続の都合ではありません。ここが持つのは「受け取った条件を契約の形へ写す」ことだけです。
 */
export type ManagedUserQuery = {
  /** 1 から数えるページ番号。 */
  readonly page: number;
  /** 1 ページあたりの件数。 */
  readonly perPage: number;
  /** 有効な利用者だけ / 退会済みだけ。区別しないなら省く。 */
  readonly active?: boolean;
};

/** 契約の応答 1 件を、一覧が並べる形へ写す。 */
function toManagedUser(wire: z.infer<typeof GetUsersResponse>["users"][number]): ManagedUser {
  return {
    id: toUserId(wire.id),
    firstName: wire.firstName,
    lastName: wire.lastName,
    email: wire.email,
    phone: wire.phone,
    deletedAt: wire.deletedAt,
  };
}

/**
 * 利用者を一覧で取得する。
 *
 * @remarks
 * **offset 方式です**。契約が位置と全件数を返すため、任意のページへ跳べます。cursor 方式の
 * 一覧（商品・購入）とはページ送りの部品から違います。
 *
 * `active` を省くと退会済みを含む全件が返ります。3 値であることを `boolean | undefined` で
 * そのまま表すのは、「有効だけ」「退会済みだけ」「区別しない」がいずれも意味を持つためです。
 *
 * admin の役割を要します。役割の判定はこの手前（`app` 層の断言と `admin` の器）にあり、ここは
 * 通った要求だけを受けます。
 */
export const getManagedUserPage = cache(
  async (query: ManagedUserQuery): Promise<OffsetPage<ManagedUser>> => {
    const params = GetUsersQueryParams.parse({
      page: query.page,
      perPage: query.perPage,
      ...(query.active === undefined ? {} : { active: query.active }),
    });

    const wire = await getClient().request({
      path: "/v1/users",
      searchParams: {
        active: params.active?.toString(),
        page: params.page.toString(),
        perPage: params.perPage.toString(),
      },
      schema: GetUsersResponse,
    });

    return {
      items: wire.users.map(toManagedUser),
      total: wire.total,
      perPage: wire.limit,
      offset: wire.offset,
    };
  },
);

/**
 * 利用者を 1 件退会させる。
 *
 * @remarks
 * {@link withdrawMe} と別の口にしています。あちらは自分を退会させたあと手元の session を畳み
 * ますが、こちらは他人が対象なので、操作した側の session は残ったままでなければなりません。
 *
 * `409` が返る事情は {@link withdrawMe} と同じです。**ただしその取消・在庫の戻しは同期しません**
 * —— 拒まれたという事実だけがここで判り、後始末が終わったかどうかは判りません。
 *
 * @param id - 退会させる利用者
 */
export async function withdrawUser(id: UserId): Promise<void> {
  await getClient().request({
    path: `/v1/users/${encodeURIComponent(id)}`,
    method: "DELETE",
    schema: DeleteUsersDetailResponse,
  });
}

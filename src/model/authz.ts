import { hasAllowedRole, SESSION_ROLE, type Session, type SessionRole } from "./session";

/**
 * 認証だけを要求する経路で許す役割。
 *
 * @remarks
 * 「認証さえ済んでいればよい」を、役割を書かないことではなく**全役割を並べること**で表します。
 * 省略で表すと、役割を足したときに既定でどちらへ倒れるのかが宣言から読めません。
 */
const AUTHENTICATED_ROLES: readonly SessionRole[] = [SESSION_ROLE.admin, SESSION_ROLE.user];

/** 管理画面へ入れる役割。 */
const ADMIN_ROLES: readonly SessionRole[] = [SESSION_ROLE.admin];

/** 保護する経路 1 件と、そこで求める役割。 */
type RoutePolicy = {
  /** 保護の対象になるパスの接頭辞。 */
  readonly prefix: string;
  /** その経路へ入れる役割。 */
  readonly allowed: readonly SessionRole[];
};

/**
 * 保護する経路の一覧。
 *
 * @remarks
 * **保護されている側を列挙します。** 公開側を列挙する書き方だと、新しく足した画面が既定で公開に
 * なり、書き忘れがそのまま漏洩になります。
 *
 * `/account` と `/admin` はテンプレートから作った側が最初に書き換える置き場です。同梱サンプルの画面は破棄と一緒に
 * 消えますが、保護の宣言そのものは残す必要があるため、中立な接頭辞を置いています。
 *
 * **求める役割が違う 2 つを残します。** 認証だけを求める宣言しか残らないと、役割が足りない主体を
 * 弾く経路がどこにも無くなります。前捌きにも確定認可にもその分岐は残るのに、それを通す入力を
 * 作れなくなり、機構が動くことを確かめられません。
 *
 * **接頭辞は入れ子にしません。** 入れ子を許すと、どちらの宣言が勝つかを決める規則が要り、宣言の
 * 並べ替えだけで認可が変わる状態を作れます。1 つの経路に 2 通りの役割を求めたくなったときは、
 * 規則を足す前にその設計自体を見直します。
 */
const ROUTE_POLICIES: readonly RoutePolicy[] = [
  { prefix: "/account", allowed: AUTHENTICATED_ROLES },
  { prefix: "/admin", allowed: ADMIN_ROLES },
  { prefix: "/checkout", allowed: AUTHENTICATED_ROLES }, // sample:line
  { prefix: "/mypage", allowed: AUTHENTICATED_ROLES }, // sample:line
  { prefix: "/onboarding", allowed: AUTHENTICATED_ROLES }, // sample:line
  { prefix: "/purchases", allowed: AUTHENTICATED_ROLES }, // sample:line
];

/**
 * 保護している経路の先頭。
 *
 * @remarks
 * 宣言したすべてが実際に前捌きへ届くかを、検査が確かめられるように公開します。検査側が一覧を
 * 書き写すと、ここへ足した経路が検査を素通りします。
 */
export const PROTECTED_PREFIXES: readonly string[] = ROUTE_POLICIES.map((policy) => policy.prefix);

/**
 * そのパスへ入れる役割を返す。
 *
 * @remarks
 * 接頭辞は区切りまで含めて照らします。文字列として前方一致するだけでは、`/accounts-public` の
 * ような別の経路が `/account` の宣言に巻き込まれます。
 *
 * 当たるのは高々 1 つです。宣言が入れ子を持たないためで、その約束は {@link ROUTE_POLICIES} が
 * 持ちます。
 *
 * @param pathname - 判定するパス
 * @returns 保護されていなければ null
 */
export function allowedRolesFor(pathname: string): readonly SessionRole[] | null {
  const matched = ROUTE_POLICIES.find(
    (policy) => pathname === policy.prefix || pathname.startsWith(`${policy.prefix}/`),
  );

  return matched?.allowed ?? null;
}

/**
 * その session が管理画面へ入れるかを判定する。
 *
 * @remarks
 * **確定認可も、導線の出し分けも、この 1 つの述語を使います。** 判定が別々に書かれていると
 * 「入れないのに入口が出ている」状態を作れてしまいます。
 *
 * **これは楽観的な判定です。** session の中身が正しいことは前提であり、それを保証するのは
 * cookie を復元する境界（`adapters/server`）の仕事です。
 *
 * @param session - 判定対象。未認証なら null
 */
export function isAdmin(session: Session | null): boolean {
  return hasAllowedRole(session, ADMIN_ROLES);
}

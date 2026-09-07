/**
 * 認証済み利用者の身元。cookie へ載せる payload はこの型に閉じる。
 *
 * @remarks
 * 後続のリクエストで使う一意な値だけを持ち、氏名・メール・電話番号のような PII は持ちません
 * （[0079](../../docs/adr/0079-auth-frontend-seam.md) §1）。
 *
 * Access Token はこの型に含めません。ブラウザへ渡してよい値と、境界の内側だけで使う値を同じ型に
 * 混ぜると、内側へ渡す段で落とし忘れが起きます。トークンの保管形式は `adapters/server` の
 * Resolver が閉じて持ちます。
 */
export type Session = {
  /** IdP が発行した subject。利用者を一意に指す。 */
  readonly userId: string;
  /** 認可判定に使う役割。 */
  readonly role: SessionRole;
  /** この session が失効する時刻。 */
  readonly expiresAt: Date;
};

/**
 * 役割の集合。
 *
 * @remarks
 * boilerplate は「特権を持つ側」と「持たない側」の 2 つだけを敷きます。実際の役割体系は
 * バックエンドと IdP が所有するため、テンプレートから作った側はこの集合を自分の体系へ置き換えます。
 */
export const SESSION_ROLE: Readonly<{ admin: "admin"; user: "user" }> = {
  admin: "admin",
  user: "user",
};

/** {@link SESSION_ROLE} の値。 */
export type SessionRole = (typeof SESSION_ROLE)[keyof typeof SESSION_ROLE];

/**
 * session が許可された役割のいずれかを持つかを判定する。
 *
 * @remarks
 * 未認証（`null`）は常に不許可です。呼び出し側が「session が無い」と「役割が足りない」を別々に
 * 書き分けずに済むよう、判定をここへ寄せています。表示の出し分けと確定認可の双方がこの 1 つの
 * 述語を使うことで、両者の判定条件がずれません。
 *
 * これは**楽観的な判定**です。session の中身が正しいことは前提であり、それを保証するのは
 * cookie を復元する境界（`adapters/server`）の仕事です。
 *
 * @param session - 判定対象。未認証なら null
 * @param allowed - 許可する役割
 */
export function hasAllowedRole(
  session: Session | null,
  allowed: readonly SessionRole[],
): session is Session {
  return session !== null && allowed.includes(session.role);
}

/**
 * session が失効しているかを判定する。
 *
 * @param session - 判定対象
 * @param now - 判定の基準時刻
 */
export function isSessionExpired(session: Session, now: Date): boolean {
  return session.expiresAt.getTime() <= now.getTime();
}

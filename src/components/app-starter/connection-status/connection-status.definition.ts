const CONNECTING_CONNECTION_STATUS = "connecting";
const RECEIVING_CONNECTION_STATUS = "receiving";
const RECONNECTING_CONNECTION_STATUS = "reconnecting";
const OFFLINE_CONNECTION_STATUS = "offline";
const SUSPENDED_CONNECTION_STATUS = "suspended";
const HALTED_CONNECTION_STATUS = "halted";
const EXPIRED_CONNECTION_STATUS = "expired";

/**
 * 継続的な受信がいまどうなっているかを表す定数。
 *
 * @remarks
 * 通信の手段を知りません。**受け取り続けられているかどうか**だけを表すため、購読でも定期取得でも
 * 同じ語で表せます。
 *
 * @see Storybook `Status/ConnectionStatus`
 */
export const CONNECTION_STATUS: Readonly<{
  CONNECTING: "connecting";
  RECEIVING: "receiving";
  RECONNECTING: "reconnecting";
  OFFLINE: "offline";
  SUSPENDED: "suspended";
  HALTED: "halted";
  EXPIRED: "expired";
}> = {
  /** 繋ぎにいっている。まだ受け取っていない。 */
  CONNECTING: CONNECTING_CONNECTION_STATUS,
  /** 受け取れている。 */
  RECEIVING: RECEIVING_CONNECTION_STATUS,
  /** 切れたので繋ぎ直している。 */
  RECONNECTING: RECONNECTING_CONNECTION_STATUS,
  /** 回線が無い。 */
  OFFLINE: OFFLINE_CONNECTION_STATUS,
  /** 受け取る対象がまだ無い。 */
  SUSPENDED: SUSPENDED_CONNECTION_STATUS,
  /** 打ち切った。繋ぎ直しても同じ結果になる。 */
  HALTED: HALTED_CONNECTION_STATUS,
  /** 資格が切れた。入り直せば再開できる。 */
  EXPIRED: EXPIRED_CONNECTION_STATUS,
};

/** {@link CONNECTION_STATUS} のいずれか。 */
export type ConnectionStatusValue = (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS];

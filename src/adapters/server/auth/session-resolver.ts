import "server-only";

import type { Session } from "@/model/session";

/**
 * 認可要求の往復で持ち回る一時状態。
 *
 * @remarks
 * IdP へ送り出してから callback で戻るまでの間だけ生きます。`state` は要求と応答の対応づけ、
 * `codeVerifier` は PKCE の検証、`nonce` は ID Token の再生防止に使います。
 */
export type AuthorizationTransaction = {
  /** 要求と応答を対応づける値。 */
  readonly state: string;
  /** PKCE の検証子。challenge の元になる。 */
  readonly codeVerifier: string;
  /** ID Token の再生を防ぐ値。 */
  readonly nonce: string;
  /** 認証後に戻す先。検証済みの相対パス。 */
  readonly returnUrl: string;
};

/** 認可要求の開始結果。 */
export type AuthorizationRequest = {
  /** 利用者のブラウザを送り出す先。 */
  readonly authorizationUrl: string;
  /** callback まで持ち回る一時状態。 */
  readonly transaction: AuthorizationTransaction;
};

/**
 * session と、境界の内側だけで使うトークンの組。
 *
 * @remarks
 * `session` は内側の層へ渡してよい身元、`accessToken` は `adapters/server` から出してはいけない
 * 値です。2 つを別の名前で持つことで、内側へ渡す際に「`session` だけを渡す」が既定になります。
 */
export type SessionRecord = {
  /** 内側の層へ渡してよい身元。 */
  readonly session: Session;
  /** API 呼び出しに付ける Bearer。ブラウザへも内側の層へも渡さない。 */
  readonly accessToken: string;
  /**
   * ログアウト時に IdP へ渡す ID Token。
   *
   * @remarks
   * RP-Initiated Logout は `id_token_hint` で「誰の session を終わらせるか」を伝えます。これを
   * 持たないと IdP 側の session が残り、ログアウト直後の再ログインが認証を求めずに素通りします。
   * 利用者から見れば「ログアウトできていない」のと同じです。
   */
  readonly idToken: string;
};

/**
 * 認証方式の差異を閉じ込める差し替え点。
 *
 * @remarks
 * 持つのは既定実装 1 つであり、唯一の実装ではありません。OIDC クライアントの実装、
 * session の暗号化方式、トークンの保管形式はこの面の内側にあり、差し替える側は
 * 自社方式へ移るときにこの面だけを差し替えます。
 *
 * 逆に、保護ルートの判定・`returnUrl` の検証・ログアウト時の状態破棄・役割による認可は
 * この面の**外側**にあります。それらは方式が変わっても変わらないため、Resolver の内側へ入れると
 * 差し替えのたびに書き直す羽目になります。
 *
 * `refresh` を置いていないのは、それを使う既定実装が無いためです。設置面のない面を先に敷くと、
 * 実装時に必ず形が変わります。IdP が refresh を持つ場合、その更新は
 * {@link SessionResolver.restore} の内側で完結させられます。
 */
export type SessionResolver = {
  /**
   * 認可要求を組み立てる。
   *
   * @param returnUrl - 認証後に戻す先。検証済みの相対パスであること
   */
  startAuthorization(returnUrl: string): Promise<AuthorizationRequest>;

  /**
   * callback で受け取った認可コードを session へ交換する。
   *
   * @throws 交換に失敗したとき、`state` が一致しないとき、ID Token が検証を通らないとき
   */
  completeAuthorization(input: {
    /** IdP が返した認可コード。 */
    readonly code: string;
    /** IdP が返した `state`。 */
    readonly state: string;
    /** 要求時に保存した一時状態。 */
    readonly transaction: AuthorizationTransaction;
  }): Promise<SessionRecord>;

  /** cookie へ載せる 1 つの文字列へ封緘する。 */
  seal(record: SessionRecord): Promise<string>;

  /**
   * 認可要求の一時状態を、cookie へ載せる 1 つの文字列へ封緘する。
   *
   * @remarks
   * session と同じく Resolver に閉じます。一時状態が何を含むかは方式ごとに違い
   * （PKCE なら検証子、別方式なら別のもの）、cookie を扱う側がその形を知っていると、方式を
   * 差し替えるたびに cookie 側も書き直すことになります。
   */
  sealTransaction(transaction: AuthorizationTransaction): Promise<string>;

  /**
   * cookie の値から復元する。
   *
   * @returns 復元できなければ null。壊れた cookie と未ログインを呼び出し側で区別させない
   */
  restore(sealed: string): Promise<SessionRecord | null>;

  /**
   * cookie の値から一時状態を復元する。
   *
   * @returns 復元できなければ null。往復をやり直させる
   */
  restoreTransaction(sealed: string): Promise<AuthorizationTransaction | null>;

  /**
   * IdP 側の session を終わらせるために、利用者のブラウザを送り出す先を組み立てる。
   *
   * @remarks
   * **返すのは送り先であって、ここから要求は出しません。** IdP 側の session を保持しているのは
   * 利用者のブラウザが持つ cookie であり、サーバから叩いた要求にそれは載りません。**要求自体は
   * 成功を返しながら、IdP 側は何も終わりません。** 遷移そのものを呼び出し側に行わせると、
   * 終わったかどうかが利用者の画面に出ます。
   *
   * 自分の cookie を消すのは呼び出し側の仕事です。IdP 側で何が要るかは方式ごとに違うため
   * （標準の `end_session_endpoint`、独自の口、そもそも口を持たないもの）、その差だけをここへ
   * 閉じます。
   *
   * @returns 利用者のブラウザを送り出す先。終わらせる口を持たない IdP なら null
   */
  endSession(record: SessionRecord): Promise<string | null>;
};

import "server-only";

import { getEnvironment } from "../environment";
import type { HttpEnvironment } from "./http.schema";

class HttpConfig {
  readonly #maxUrlBytes: number;
  readonly #maxUploadBytes: number;
  readonly #allowedOrigins: readonly string[];

  private constructor(
    maxUrlBytes: number,
    maxUploadBytes: number,
    allowedOrigins: readonly string[],
  ) {
    this.#maxUrlBytes = maxUrlBytes;
    this.#maxUploadBytes = maxUploadBytes;
    this.#allowedOrigins = allowedOrigins;
  }

  /** 検証済み ENV から production singleton を組み立てる。 */
  static fromValues(values: HttpEnvironment): HttpConfig {
    return new HttpConfig(
      values.NEXT_PUBLIC_HTTP_MAX_URL_BYTES,
      values.NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES,
      values.HTTP_ALLOWED_ORIGINS,
    );
  }

  /**
   * BFF（`/api/*`）を別 origin から呼ばせる相手。
   *
   * @remarks
   * 空なら同一 origin だけです。`src/proxy.ts` が CORS と origin 検証の両方でこの値を読みます
   * （`docs/rules.md`「認可と入口」の「状態を変える要求の送信元を検証する」）。
   */
  get allowedOrigins(): readonly string[] {
    return this.#allowedOrigins;
  }

  /**
   * 1 つの要求 URL に許すバイト数の上限。
   *
   * @remarks
   * 経路のどこが最初に URL を弾くか（ブラウザ / CDN / リバースプロキシ / backend）は配信構成で
   * 変わるため、その最小値を環境変数から受け取ります。
   */
  get maxUrlBytes(): number {
    return this.#maxUrlBytes;
  }

  /**
   * 中継する 1 件のアップロードに許すバイト数の上限。
   *
   * @remarks
   * 中継の経路では配備先が先に要求を打ち切るため、その上限より内側に取ります。外側に置いた値は
   * 表明されるだけで効きません。
   */
  get maxUploadBytes(): number {
    return this.#maxUploadBytes;
  }
}

let httpConfig: HttpConfig | undefined;

/** http adapter が利用する、プロセス内で不変な singleton を返す。 */
export function getHttpConfig(): HttpConfig {
  httpConfig ??= HttpConfig.fromValues(getEnvironment());
  return httpConfig;
}

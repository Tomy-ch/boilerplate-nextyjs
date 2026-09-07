import "server-only";

import { getAuthConfig } from "@/config/auth/auth.server";
import { getHttpConfig } from "@/config/http/http.server";
import { isDevelopmentOnlyEndpointOpen } from "@/config/load-environment";

import { fetchSessionRole } from "../api/user-roles"; // sample:line
import { taintUniqueValue } from "../taint/taint";
import {
  createDefaultSessionResolver,
  type DefaultSessionResolverDeps,
} from "./default-session-resolver";
import { createDevelopmentSessionResolver } from "./development-session-resolver";
import type { SessionResolver } from "./session-resolver";

let resolver: SessionResolver | undefined;

/**
 * 認可の開始先を、開発用の面へ差し替えるか。
 *
 * @remarks
 * **環境と併せて見ます。** `AUTH_MODE` だけを条件にすると、設定を誤って実環境へ `dev` を与えた
 * 瞬間に、IdP を通らずに任意の役割で入れる経路が公開ドメインで開きます。開ける環境の一覧は
 * `developmentOnlyEnvironments` の 1 か所のままにします。
 */
function usesDevelopmentAuthorization(): boolean {
  return getAuthConfig().mode === "dev" && isDevelopmentOnlyEndpointOpen();
}

/**
 * 同梱している Resolver を返す。
 *
 * @remarks
 * テンプレートから作った側の差し替え単位は `SessionResolver` です（[README](./README.md) の「差し替え点」）。
 *
 * cookie を触る側（`session.ts`）と入口の楽観判定（`optimistic-session.ts`）の両方から使うため、
 * どちらにも寄せずに独立させています。片方へ置くと、もう片方が `next/headers` のような
 * 実行文脈まで一緒に引き込みます。
 *
 * 一度作った Resolver を使い回します。呼ぶたびに作り直すと、Resolver が抱える Discovery と
 * 鍵の取得結果も毎回捨てることになります。
 */
export function getSessionResolver(): SessionResolver {
  const config = getAuthConfig();

  // 署名鍵を汚す。文字列は参照で追えないので値そのものを登録し、登録の寿命はこの値を持つ
  // singleton に握らせる（[0030](../../../../docs/adr/0030-environment-variable-management.md) §8）。
  // config カーネルは react を持ち込めないため、登録は読む側であるここが行う。
  taintUniqueValue(
    "session の署名鍵は server 専用です。Client Component へ渡さないでください",
    config,
    config.sessionSecret,
  );

  const deps: DefaultSessionResolverDeps = {
    issuer: config.issuer,
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scopes: config.scopes,
    sessionSecret: config.sessionSecret,
    maxUrlBytes: getHttpConfig().maxUrlBytes,
    resolveRole: fetchSessionRole, // sample:line
  };

  resolver ??= usesDevelopmentAuthorization()
    ? createDevelopmentSessionResolver(deps)
    : createDefaultSessionResolver(deps);

  return resolver;
}

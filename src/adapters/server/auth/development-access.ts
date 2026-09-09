import "server-only";

import { headers } from "next/headers";

import { isDevelopmentOnlyEndpointOpen } from "@/config/load-environment";

/**
 * 開発専用の口を開けてよい宛先。
 *
 * @remarks
 * 手元のループバックに加えて `host.docker.internal` を含みます。E2E は Playwright を**コンテナの
 * 中で**動かし、そこから見た開発機がこの名前になるためです（`.makefiles/testing/e2e.mk`）。
 * どちらも開発機の中だけで解決する名前で、公開ドメインとして現れることがありません。
 */
const DEVELOPMENT_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
]);

/** `Host` の値からポートと IPv6 の角括弧を落とす。 */
function toHostname(value: string): string {
  const trimmed = value.trim().toLowerCase();

  if (trimmed.startsWith("[")) {
    return trimmed.slice(1, trimmed.indexOf("]"));
  }

  const port = trimmed.indexOf(":");

  return port === -1 ? trimmed : trimmed.slice(0, port);
}

/**
 * 開発専用の口を、この要求に対して開いてよいか。
 *
 * @remarks
 * **環境と宛先の両方を見ます。** `APP_ENV` だけを条件にすると、設定を誤って実環境へ `local` を
 * 与えた瞬間に、誰でも任意の役割の session を発行できる口が公開ドメインで開きます。宛先まで
 * 見ておけば、その事故の被害が手元へ届く経路だけに留まります。
 *
 * **宛先の判定は防御線ではありません。** `Host` は要求側が名乗る値で、偽れます。ここが止めるのは
 * 「設定を誤ったまま公開してしまった」ときに**普通の利用者が普通に踏む**経路であり、狙って偽る
 * 相手を止めるのは `APP_ENV` の側です。
 *
 * 転送された宛先（`X-Forwarded-Host`）も同じ条件で見ます。手前に proxy が立つ配置では、公開
 * ドメインがそちらへ載り `Host` には内部の名前が来るためです。
 *
 * 宛先を名乗らない要求は閉じます。判定できないものを開ける側へ倒すと、条件が無い要求が最も
 * 通りやすくなります。
 */
export async function isDevelopmentAccessAllowed(): Promise<boolean> {
  if (!isDevelopmentOnlyEndpointOpen()) {
    return false;
  }

  const requestHeaders = await headers();
  const declaredHosts = [requestHeaders.get("host"), requestHeaders.get("x-forwarded-host")].filter(
    (value): value is string => value !== null && value !== "",
  );

  return (
    declaredHosts.length > 0 &&
    declaredHosts.every((value) => DEVELOPMENT_HOSTS.has(toHostname(value)))
  );
}

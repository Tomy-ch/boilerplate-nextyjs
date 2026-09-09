import { vi } from "vitest";

import type { Environment } from "./environment";

/**
 * 検証を通る環境変数一式。
 *
 * @remarks
 * schema は全 purpose の変数をまとめて検証するため、purpose を 1 つだけ確かめたい場合でも
 * 一式を揃える必要があります。各テストが自分の分だけを stub すると、他の purpose の欠落で
 * 落ちて検査したい判定へ到達しません。
 *
 * **変数の並びを書くのはここだけです。** 同じ一式をテスト側にも持つと、変数を 1 つ足すたびに
 * 同じ追記が写しの数だけ要り、片方を忘れた状態を型検査が拾うまで気づけません。
 */
export const VALID_ENVIRONMENT = {
  APP_API_BASE_URL: "https://api.example.test",
  APP_API_MODE: "mock",
  APP_MAINTENANCE_MODE: "off",
  CLOCK_FIXED_NOW: "2026-01-01T00:00:00.000Z",
  MEDIA_ORIGIN: "https://media.example.test",
  OBS_SERVICE_NAME: "Boilerplate Web",
  OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.test/v1/traces",
  OBS_TRACES_EXPORTER: "otlp",
  OBS_METRICS_EXPORTER: "none",
  OBS_LOGS_EXPORTER: "",
  OBS_RENDER_SPANS: "screen",
  AUTH_MODE: "idp",
  AUTH_ISSUER: "https://id.example.test",
  AUTH_CLIENT_ID: "nextjs-boilerplate",
  AUTH_REDIRECT_URI: "https://app.example.test/auth/callback",
  AUTH_SCOPES: "openid profile",
  AUTH_SESSION_SECRET: "01234567890123456789012345678901",
  NEXT_PUBLIC_HTTP_MAX_URL_BYTES: "8000",
  NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES: "4194304",
  NEXT_PUBLIC_ANALYTICS_GTM_CONTAINER_ID: "GTM-TEST0000",
  HTTP_ALLOWED_ORIGINS: "",
  SITE_PUBLIC_ORIGIN: "https://www.example.test",
  SITE_INDEXABLE: "off",
} satisfies Record<keyof Environment, string>;

/** 検証を通る環境変数一式を stub する。 */
export function stubValidEnvironment(): void {
  for (const [name, value] of Object.entries(VALID_ENVIRONMENT)) {
    vi.stubEnv(name, value);
  }
}

/**
 * 検証を通ったあとの環境変数一式。
 *
 * @remarks
 * `getEnvironment` を差し替えるテストが必要とするのはこちらです。**{@link stubValidEnvironment} の
 * 生の値を parse した結果ではありません。**あちらは受理される形を敢えて散らして検証そのものを
 * 確かめる値で、こちらは観測が信号を出さないよう exporter を落とした値です。
 *
 * **境界のテストが自分で組み立てないための 1 か所です。** 理由は {@link VALID_ENVIRONMENT} と
 * 同じです。
 */
export const PARSED_ENVIRONMENT: Environment = {
  APP_API_BASE_URL: "https://api.example.test",
  APP_API_MODE: "mock",
  APP_MAINTENANCE_MODE: "off",
  CLOCK_FIXED_NOW: "2026-01-01T00:00:00.000Z",
  MEDIA_ORIGIN: "https://media.example.test",
  OBS_SERVICE_NAME: "Boilerplate Web",
  OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.test/v1/traces",
  OBS_TRACES_EXPORTER: "none",
  OBS_METRICS_EXPORTER: "none",
  OBS_LOGS_EXPORTER: "none",
  OBS_RENDER_SPANS: "none",
  AUTH_MODE: "idp",
  AUTH_ISSUER: "https://id.example.test",
  AUTH_CLIENT_ID: "nextjs-boilerplate",
  AUTH_REDIRECT_URI: "https://app.example.test/auth/callback",
  AUTH_SCOPES: "openid profile",
  AUTH_SESSION_SECRET: "01234567890123456789012345678901",
  NEXT_PUBLIC_HTTP_MAX_URL_BYTES: 8000,
  NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES: 4194304,
  NEXT_PUBLIC_ANALYTICS_GTM_CONTAINER_ID: "GTM-TEST0000",
  HTTP_ALLOWED_ORIGINS: [],
  SITE_PUBLIC_ORIGIN: "https://www.example.test",
  SITE_INDEXABLE: "off",
};

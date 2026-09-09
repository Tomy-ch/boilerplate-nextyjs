import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubValidEnvironment, VALID_ENVIRONMENT } from "./environment.fixture";

/** 同梱の秘密値。`AUTH_SESSION_SECRET` の schema が `local` / `ci` 以外で拒否する綴り。 */
const SHIPPED_SESSION_SECRET = "local-development-session-secret-change-before-production";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  stubValidEnvironment();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getEnvironment", () => {
  // ----- 正常系 -----
  it("検証済みの環境変数を同じ singleton として返す", async () => {
    const { getEnvironment, validateEnvironment } = await import("./environment");

    const first = getEnvironment();
    const second = getEnvironment();

    expect(first).toBe(second);
    expect(first).toEqual({
      ...VALID_ENVIRONMENT,
      NEXT_PUBLIC_HTTP_MAX_URL_BYTES: 8000,
      NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES: 4194304,
      HTTP_ALLOWED_ORIGINS: [],
    });
    expect(() => validateEnvironment()).not.toThrow();
  });

  it("code default を持つ変数は、env ファイルに無くても既定へ落ちる", async () => {
    vi.stubEnv("AUTH_MODE", undefined);
    const { getEnvironment } = await import("./environment");

    expect(getEnvironment().AUTH_MODE).toBe("idp");
  });
});

describe("validateEnvironment", () => {
  // ----- 正常系 -----
  it("purpose ごとの Config getter が対応する値を返す", async () => {
    const [
      { getApiConfig },
      { getAuthConfig },
      { getHttpConfig },
      { getMediaConfig },
      { getObservabilityConfig },
      { getSiteConfig },
    ] = await Promise.all([
      import("./api/api.server"),
      import("./auth/auth.server"),
      import("./http/http.server"),
      import("./media/media.server"),
      import("./observability/observability.server"),
      import("./site/site.server"),
    ]);

    expect(getApiConfig()).toMatchObject({
      baseUrl: VALID_ENVIRONMENT.APP_API_BASE_URL,
      mode: VALID_ENVIRONMENT.APP_API_MODE,
    });
    expect(getAuthConfig()).toMatchObject({
      mode: VALID_ENVIRONMENT.AUTH_MODE,
      issuer: VALID_ENVIRONMENT.AUTH_ISSUER,
      clientId: VALID_ENVIRONMENT.AUTH_CLIENT_ID,
      redirectUri: VALID_ENVIRONMENT.AUTH_REDIRECT_URI,
      scopes: VALID_ENVIRONMENT.AUTH_SCOPES,
      sessionSecret: VALID_ENVIRONMENT.AUTH_SESSION_SECRET,
    });
    expect(getHttpConfig()).toMatchObject({
      maxUrlBytes: Number(VALID_ENVIRONMENT.NEXT_PUBLIC_HTTP_MAX_URL_BYTES),
      maxUploadBytes: Number(VALID_ENVIRONMENT.NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES),
    });
    expect(getMediaConfig()).toMatchObject({ origin: VALID_ENVIRONMENT.MEDIA_ORIGIN });
    expect(getObservabilityConfig()).toMatchObject({
      otlpEndpoint: VALID_ENVIRONMENT.OTEL_EXPORTER_OTLP_ENDPOINT,
      tracesEnabled: true,
      metricsEnabled: false,
      logsEnabled: false,
    });
    expect(getSiteConfig()).toMatchObject({
      publicOrigin: VALID_ENVIRONMENT.SITE_PUBLIC_ORIGIN,
      isIndexable: false,
    });
  });

  it("起動 bootstrap が全 server Config を評価する", async () => {
    vi.stubEnv("APP_ENV", "local");
    const { bootstrapConfig } = await import("./bootstrap.server");

    await expect(bootstrapConfig()).resolves.toBeUndefined();
  });

  it("local では同梱の秘密値をそのまま通す", async () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("AUTH_SESSION_SECRET", SHIPPED_SESSION_SECRET);
    const { getEnvironment, validateEnvironment } = await import("./environment");

    expect(() => validateEnvironment()).not.toThrow();
    expect(getEnvironment().AUTH_SESSION_SECRET).toBe(SHIPPED_SESSION_SECRET);
  });

  // ----- 異常系 -----
  it("必須の環境変数が欠落すると検証に失敗する", async () => {
    vi.stubEnv("AUTH_SESSION_SECRET", undefined);
    const { validateEnvironment } = await import("./environment");

    expect(() => validateEnvironment()).toThrow("AUTH_SESSION_SECRET");
  });

  it("local / ci 以外では同梱の秘密値を拒否する", async () => {
    vi.stubEnv("APP_ENV", "prd");
    vi.stubEnv("AUTH_SESSION_SECRET", SHIPPED_SESSION_SECRET);
    const { validateEnvironment } = await import("./environment");

    expect(() => validateEnvironment()).toThrow("AUTH_SESSION_SECRET");
  });

  it("不正な URL・空文字・短い secret を拒否する", async () => {
    vi.stubEnv("APP_API_BASE_URL", "ftp://api.example.test");
    vi.stubEnv("MEDIA_ORIGIN", "ftp://media.example.test");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "ftp://otel.example.test");
    vi.stubEnv("AUTH_ISSUER", "ftp://id.example.test");
    vi.stubEnv("AUTH_CLIENT_ID", "");
    vi.stubEnv("AUTH_REDIRECT_URI", "ftp://app.example.test/auth/callback");
    vi.stubEnv("AUTH_SCOPES", "   ");
    vi.stubEnv("AUTH_SESSION_SECRET", "short");
    const { validateEnvironment } = await import("./environment");

    expect(() => validateEnvironment()).toThrow(
      "APP_API_BASE_URL, MEDIA_ORIGIN, OTEL_EXPORTER_OTLP_ENDPOINT, AUTH_ISSUER, AUTH_CLIENT_ID, AUTH_REDIRECT_URI, AUTH_SCOPES, AUTH_SESSION_SECRET",
    );
  });

  it("未対応の APP_ENV を拒否する", async () => {
    vi.stubEnv("APP_ENV", "unsupported");
    const { loadEnvironment } = await import("./load-environment");

    expect(() => loadEnvironment()).toThrow(
      "APP_ENV は local, ci, dev, stg, prd のいずれかを指定してください",
    );
  });
});

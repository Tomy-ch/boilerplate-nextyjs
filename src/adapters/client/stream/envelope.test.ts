import { describe, expect, it } from "vitest";

import { CONTROL_ACTION, parseControl, parseEnvelope } from "./envelope";

const ENVELOPE = {
  eventId: "123e4567-e89b-12d3-a456-426614174000",
  streamId: "stream-a",
  sequence: "3",
  type: "resource.created.v1",
  occurredAt: "2026-09-01T12:00:00Z",
  schemaVersion: 1,
  payload: { messageId: "m1" },
};

describe("parseEnvelope", () => {
  it("封筒として読める event を返す", () => {
    expect(parseEnvelope(JSON.stringify(ENVELOPE))).toMatchObject({ sequence: "3" });
  });

  it("本文の形は見ない", () => {
    const parsed = parseEnvelope(JSON.stringify({ ...ENVELOPE, payload: { unknown: true } }));

    expect(parsed).not.toBeNull();
  });

  it("位置が契約の形を外れた event を落とす", () => {
    expect(parseEnvelope(JSON.stringify({ ...ENVELOPE, sequence: 3 }))).toBeNull();
  });

  it("JSON として読めない文字列で例外を投げない", () => {
    expect(parseEnvelope("{")).toBeNull();
  });
});

describe("parseControl", () => {
  it("制御指示を返す", () => {
    const control = JSON.stringify({ action: "STOP", reason: "AUTHORIZATION_REVOKED" });

    expect(parseControl(control)).toEqual({
      action: CONTROL_ACTION.stop,
      reason: "AUTHORIZATION_REVOKED",
    });
  });

  it("待ち時間の目安を受け取る", () => {
    const control = JSON.stringify({
      action: "RETRY_LATER",
      reason: "TEMPORARILY_OVERLOADED",
      retryAfterMs: 5_000,
    });

    expect(parseControl(control)).toMatchObject({ retryAfterMs: 5_000 });
  });

  it("契約に無い動作を落とす", () => {
    expect(parseControl(JSON.stringify({ action: "SLEEP", reason: "X" }))).toBeNull();
  });

  it("理由の綴りは契約に縛らない", () => {
    const control = JSON.stringify({ action: "RECONNECT", reason: "SOMETHING_NEW" });

    expect(parseControl(control)).toMatchObject({ reason: "SOMETHING_NEW" });
  });
});

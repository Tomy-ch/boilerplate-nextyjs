import { describe, expect, it } from "vitest";

import { toStreamCursor } from "./cursor";
import type { StreamEnvelope } from "./envelope";
import { ADMIT_RESULT, createOrderingWindow } from "./ordering";

function envelopeAt(sequence: number): StreamEnvelope {
  return {
    eventId: `e${sequence}`,
    streamId: "stream-a",
    sequence: toStreamCursor(sequence),
    type: "resource.created.v1",
    occurredAt: "2026-09-01T12:00:00Z",
    schemaVersion: 1,
    payload: {},
  };
}

function sequencesOf(envelopes: readonly StreamEnvelope[]): readonly string[] {
  return envelopes.map((envelope) => envelope.sequence);
}

describe("createOrderingWindow", () => {
  it("到達順が乱れても、位置の昇順で流す", () => {
    const window = createOrderingWindow(toStreamCursor(0));

    window.admit(envelopeAt(3));
    window.admit(envelopeAt(1));
    window.admit(envelopeAt(2));

    expect(sequencesOf(window.drain())).toEqual(["1", "2", "3"]);
  });

  it("歯抜けを待たずに流す", () => {
    const window = createOrderingWindow(toStreamCursor(0));

    window.admit(envelopeAt(1));
    window.admit(envelopeAt(5));

    expect(sequencesOf(window.drain())).toEqual(["1", "5"]);
  });

  it("同じ位置の重複を 1 件に畳む", () => {
    const window = createOrderingWindow(toStreamCursor(0));

    window.admit(envelopeAt(2));
    window.admit(envelopeAt(2));

    expect(sequencesOf(window.drain())).toEqual(["2"]);
  });

  it("流し終えた位置を、次の開始位置として覚える", () => {
    const window = createOrderingWindow(toStreamCursor(0));

    window.admit(envelopeAt(4));
    window.drain();

    expect(window.cursor()).toBe("4");
  });

  it("何も入っていない窓では、開始位置が動かない", () => {
    const window = createOrderingWindow(toStreamCursor(7));

    expect(sequencesOf(window.drain())).toEqual([]);
    expect(window.cursor()).toBe("7");
  });

  it("流す前の窓は、溜まっているものが在ると名乗る", () => {
    const window = createOrderingWindow(toStreamCursor(0));

    window.admit(envelopeAt(1));

    expect(window.pending()).toBe(true);

    window.drain();

    expect(window.pending()).toBe(false);
  });

  it("既に流した位置は、窓へ入れず遅延として返す", () => {
    const window = createOrderingWindow(toStreamCursor(0));

    window.admit(envelopeAt(2));
    window.drain();

    expect(window.admit(envelopeAt(1))).toBe(ADMIT_RESULT.late);
    expect(window.pending()).toBe(false);
  });

  it("同じ位置が再び届いたものも、遅延として返す", () => {
    const window = createOrderingWindow(toStreamCursor(0));

    window.admit(envelopeAt(2));
    window.drain();

    expect(window.admit(envelopeAt(2))).toBe(ADMIT_RESULT.late);
  });

  it("開始位置より前の event を、最初から流さない", () => {
    const window = createOrderingWindow(toStreamCursor(5));

    expect(window.admit(envelopeAt(5))).toBe(ADMIT_RESULT.late);
    expect(window.admit(envelopeAt(6))).toBe(ADMIT_RESULT.accepted);
  });

  it("仕切り直すと、窓に残っていたものを捨てて新しい位置から始める", () => {
    const window = createOrderingWindow(toStreamCursor(0));

    window.admit(envelopeAt(9));
    window.resume(toStreamCursor(20));

    expect(window.pending()).toBe(false);
    expect(window.cursor()).toBe("20");
    expect(window.admit(envelopeAt(10))).toBe(ADMIT_RESULT.late);
  });
});

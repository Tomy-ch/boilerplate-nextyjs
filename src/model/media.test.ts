import { describe, expect, it } from "vitest";
import { mediaUrl } from "./media";

const ORIGIN = "http://media.example.test:9000";

describe("mediaUrl", () => {
  // ----- 正常系 -----
  it("配信元とオブジェクトキーを URL にする", () => {
    expect(mediaUrl(ORIGIN, "items/abc.png")).toBe(`${ORIGIN}/items/abc.png`);
  });

  it("配信元の末尾のスラッシュを重ねない", () => {
    expect(mediaUrl(`${ORIGIN}/`, "items/abc.png")).toBe(`${ORIGIN}/items/abc.png`);
  });

  it("キー先頭のスラッシュを取り除く", () => {
    expect(mediaUrl(ORIGIN, "/items/abc.png")).toBe(`${ORIGIN}/items/abc.png`);
  });

  it("配信元がサブパスを持っても経路を保つ", () => {
    expect(mediaUrl("https://cdn.example.test/media", "items/abc.png")).toBe(
      "https://cdn.example.test/media/items/abc.png",
    );
  });

  it("配信元の綴りが正規化される形でも同じ URL にする", () => {
    expect(mediaUrl("https://Media.Example.test:443", "items/abc.png")).toBe(
      "https://media.example.test/items/abc.png",
    );
  });

  it("配信元がサブパスを持つとき、キー先頭のスラッシュを落として経路を保つ", () => {
    expect(mediaUrl("https://cdn.example.test/media", "/items/abc.png")).toBe(
      "https://cdn.example.test/media/items/abc.png",
    );
  });

  it("配信元にクエリが付いていても経路を保つ", () => {
    expect(mediaUrl("https://cdn.example.test?token=x", "items/abc.png")).toBe(
      "https://cdn.example.test/items/abc.png",
    );
  });

  it("段の深いキーをその深さのまま解決する", () => {
    expect(mediaUrl(ORIGIN, "items/2026/08/0198a1b2-c3d4.png")).toBe(
      `${ORIGIN}/items/2026/08/0198a1b2-c3d4.png`,
    );
  });

  it("名前に点が並ぶキーを上位への参照と取り違えない", () => {
    expect(mediaUrl(ORIGIN, "items/a..b.png")).toBe(`${ORIGIN}/items/a..b.png`);
  });
  // ----- 異常系 -----
  it("キーが無ければ URL を作らない", () => {
    expect(mediaUrl(ORIGIN, null)).toBeNull();
  });

  it("空のキーを URL にしない", () => {
    expect(mediaUrl(ORIGIN, "")).toBeNull();
  });

  it("スラッシュだけのキーを、指す先が配信元そのものなので捨てる", () => {
    expect(mediaUrl(ORIGIN, "/")).toBeNull();
  });

  it.each([
    { kind: "別の配信元", key: "https://evil.example/x.png" },
    { kind: "中身を直接埋めた値", key: "data:image/svg+xml;base64,PHN2Zy8+" },
    { kind: "スクリプト", key: "javascript:alert(1)" },
  ])("$kind を指す、自分でスキームを持つキーを捨てる", ({ key }) => {
    expect(mediaUrl(ORIGIN, key)).toBeNull();
  });

  it("バックスラッシュで別のホストを指すキーを捨てる", () => {
    expect(mediaUrl(ORIGIN, String.raw`\\evil.example\x.png`)).toBeNull();
  });

  it("配信元のサブパスより上を指すキーを捨てる", () => {
    expect(mediaUrl("https://cdn.example.test/media", "../../secret.png")).toBeNull();
  });

  it("URL として解釈できないキーを捨てる", () => {
    expect(mediaUrl(ORIGIN, "http://[")).toBeNull();
  });
});

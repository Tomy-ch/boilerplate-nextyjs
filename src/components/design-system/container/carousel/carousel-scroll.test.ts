// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { alignSlideToStart, currentSlideIndex } from "./carousel-scroll";

/**
 * 横並びの slide を持つ領域を組む。
 *
 * jsdom はレイアウトを計算せず矩形がすべて 0 になるため、位置は `getBoundingClientRect` を
 * 差し替えて与える。差し替えるのは寸法だけで、判定そのものは実物が動く。
 */
function buildTrack(options: {
  viewLeft: number;
  viewWidth: number;
  slideLefts: readonly number[];
  slideWidth: number;
}): HTMLDivElement {
  const container = document.createElement("div");

  container.dataset["slot"] = "carousel-content";
  container.getBoundingClientRect = vi.fn(
    () => new DOMRect(options.viewLeft, 0, options.viewWidth, 0),
  );
  container.scrollBy = vi.fn();

  for (const left of options.slideLefts) {
    const slide = document.createElement("div");

    slide.dataset["slot"] = "carousel-item";
    slide.getBoundingClientRect = vi.fn(() => new DOMRect(left, 0, options.slideWidth, 0));
    container.append(slide);
  }

  return container;
}

/** 領域の N 枚目。無ければテストの前提が崩れているので落とす。 */
function slideAt(container: Element, index: number): Element {
  const slide = container.children[index];

  if (slide === undefined) {
    throw new Error(`${index} 枚目の slide がありません`);
  }

  return slide;
}

describe("alignSlideToStart", () => {
  // ----- 正常系 -----
  it("先頭との差だけ領域を送る", () => {
    const container = buildTrack({
      viewLeft: 100,
      viewWidth: 300,
      slideLefts: [100, 420],
      slideWidth: 300,
    });

    alignSlideToStart(container, slideAt(container, 1));

    expect(container.scrollBy).toHaveBeenCalledWith({ left: 320 });
  });

  it("既に先頭に来ている slide では送らない", () => {
    const container = buildTrack({
      viewLeft: 100,
      viewWidth: 300,
      slideLefts: [100],
      slideWidth: 300,
    });

    alignSlideToStart(container, slideAt(container, 0));

    expect(container.scrollBy).toHaveBeenCalledWith({ left: 0 });
  });

  it("左にある slide へは負の向きに送る", () => {
    const container = buildTrack({
      viewLeft: 100,
      viewWidth: 300,
      slideLefts: [-220],
      slideWidth: 300,
    });

    alignSlideToStart(container, slideAt(container, 0));

    expect(container.scrollBy).toHaveBeenCalledWith({ left: -320 });
  });
});

describe("currentSlideIndex", () => {
  // ----- 正常系 -----
  it("領域と最も広く重なる slide の位置を返す", () => {
    const container = buildTrack({
      viewLeft: 0,
      viewWidth: 300,
      slideLefts: [-280, 20, 340],
      slideWidth: 300,
    });

    expect(currentSlideIndex(container)).toBe(1);
  });

  it("先頭が占めていれば 0 を返す", () => {
    const container = buildTrack({
      viewLeft: 0,
      viewWidth: 300,
      slideLefts: [0, 320],
      slideWidth: 300,
    });

    expect(currentSlideIndex(container)).toBe(0);
  });

  it("重なりが同じなら先に現れた slide を採る", () => {
    const container = buildTrack({
      viewLeft: 0,
      viewWidth: 300,
      slideLefts: [-150, 150],
      slideWidth: 300,
    });

    expect(currentSlideIndex(container)).toBe(0);
  });

  // ----- 異常系 -----
  it("slide が無ければ 0 を返す", () => {
    const container = buildTrack({ viewLeft: 0, viewWidth: 300, slideLefts: [], slideWidth: 300 });

    expect(currentSlideIndex(container)).toBe(0);
  });
});

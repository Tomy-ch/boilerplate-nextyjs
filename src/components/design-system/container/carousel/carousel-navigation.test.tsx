// @vitest-environment jsdom

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type MouseEventHandler, useId } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Carousel, CarouselContent, CarouselItem } from "./carousel";
import {
  CarouselLink,
  CarouselNext,
  CarouselPrevious,
  CarouselThumbnails,
} from "./carousel-navigation";

const SLIDES = [1, 2, 3];
const SLIDE_WIDTH = 320;

const scrollBy = vi.fn();
const originalScrollBy = Element.prototype.scrollBy;

function StepFixture({ onClick }: { onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  const slideId = useId();

  return (
    <Carousel aria-label="サンプル画像">
      <CarouselContent>
        {SLIDES.map((position) => (
          <CarouselItem
            aria-label={`${position} / ${SLIDES.length}`}
            id={`${slideId}-${position}`}
            key={position}
          >
            内容 {position}
            {position > 1 ? <CarouselPrevious href={`#${slideId}-${position - 1}`} /> : null}
            {position < SLIDES.length ? (
              <CarouselNext href={`#${slideId}-${position + 1}`} onClick={onClick} />
            ) : null}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

function layOutSlides(container: HTMLElement, scrolledBy = 0) {
  const content = container.querySelector('[data-slot="carousel-content"]');

  if (content) {
    content.getBoundingClientRect = () => new DOMRect(0, 0, SLIDE_WIDTH, SLIDE_WIDTH);
  }

  const items = [...container.querySelectorAll('[data-slot="carousel-item"]')];

  for (const [index, item] of items.entries()) {
    const left = index * SLIDE_WIDTH - scrolledBy;

    item.getBoundingClientRect = () => new DOMRect(left, 0, SLIDE_WIDTH, SLIDE_WIDTH);
  }
}

type ObserverEntry = { target: Element; intersectionRatio: number };

const observed: { callback: (entries: ObserverEntry[]) => void; targets: Element[] }[] = [];

class IntersectionObserverStub {
  private readonly entry: { callback: (entries: ObserverEntry[]) => void; targets: Element[] };

  constructor(callback: (entries: ObserverEntry[]) => void) {
    this.entry = { callback, targets: [] };
    observed.push(this.entry);
  }

  observe(target: Element) {
    this.entry.targets.push(target);
  }

  unobserve() {}

  takeRecords() {
    return [];
  }

  disconnect() {
    this.entry.targets = [];
  }
}

const firstSlideId = (slideId: string) => `${slideId}-1`;
const missingSlideId = () => "存在しない";

function ThumbnailFixture({
  defaultCurrentId,
  visibleSlides = SLIDES,
}: {
  defaultCurrentId?: (slideId: string) => string;
  visibleSlides?: number[];
}) {
  const slideId = useId();

  return (
    <Carousel aria-label="サンプル画像">
      <CarouselContent>
        {visibleSlides.map((position) => (
          <CarouselItem
            aria-label={`${position} / ${SLIDES.length}`}
            id={`${slideId}-${position}`}
            key={position}
          >
            内容 {position}
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselThumbnails
        aria-label="画像の一覧"
        defaultCurrentId={defaultCurrentId === undefined ? undefined : defaultCurrentId(slideId)}
      >
        {SLIDES.map((position) => (
          <CarouselLink href={`#${slideId}-${position}`} key={position}>
            {position} 枚目
          </CarouselLink>
        ))}
      </CarouselThumbnails>
    </Carousel>
  );
}

function reportVisibility(container: HTMLElement, ratioOf: (position: number) => number) {
  const slides = [...container.querySelectorAll('[data-slot="carousel-item"]')];

  act(() => {
    for (const { callback, targets } of observed) {
      if (targets.length > 0) {
        callback(
          slides
            .map((target, index) => ({ target, intersectionRatio: ratioOf(index + 1) }))
            .filter((entry) => entry.intersectionRatio >= 0),
        );
      }
    }
  });
}

function layOutStrip(container: HTMLElement, stripWidth: number, linkWidth: number) {
  const strip = screen.getByRole("list", { name: "画像の一覧" });

  strip.getBoundingClientRect = () => new DOMRect(0, 0, stripWidth, 40);

  for (const [index, link] of [
    ...container.querySelectorAll('[data-slot="carousel-link"]'),
  ].entries()) {
    link.getBoundingClientRect = () => new DOMRect(index * linkWidth, 0, linkWidth, 40);
  }

  scrollBy.mockClear();
}

/**
 * 次の click で既定動作が止められたかを拾う。
 *
 * @remarks
 * 「fragment へ飛ばさずに送り領域だけを動かす」は、`preventDefault` が呼ばれたかどうかでしか
 * 見えません。発火した側の戻り値で見ると、押下を組み立てる手段に検証が縛られます。
 */
function watchPreventDefault(): { get prevented(): boolean } {
  let prevented = false;

  document.addEventListener(
    "click",
    (event) => {
      prevented = event.defaultPrevented;
    },
    { capture: false, once: true },
  );

  return {
    get prevented() {
      return prevented;
    },
  };
}

/** slide の中に置かれた送りの link。 */
function linkIn(slide: string, name: string): HTMLElement {
  return within(screen.getByRole("group", { name: slide })).getByRole("link", { name });
}

describe("CarouselThumbnails", () => {
  beforeEach(() => {
    observed.length = 0;
    scrollBy.mockClear();
    Element.prototype.scrollBy = scrollBy;
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    Element.prototype.scrollBy = originalScrollBy;
    vi.unstubAllGlobals();
  });

  it("名前のある一覧として公開し、hydration 前は印を付けない", () => {
    render(<ThumbnailFixture />);

    expect(screen.getByRole("list", { name: "画像の一覧" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1 枚目" })).not.toHaveAttribute("aria-current");
  });

  it("defaultCurrentId を指定すると hydration 前から現在地の印が付く", () => {
    render(<ThumbnailFixture defaultCurrentId={firstSlideId} />);

    expect(screen.getByRole("link", { name: "1 枚目" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "2 枚目" })).not.toHaveAttribute("aria-current");
  });

  it("main の slide を観測対象にする", () => {
    const { container } = render(<ThumbnailFixture />);

    expect(observed.at(-1)?.targets).toEqual([
      ...container.querySelectorAll('[data-slot="carousel-item"]'),
    ]);
  });

  it("もっとも見えている slide へ現在地の印が移る", () => {
    const { container } = render(<ThumbnailFixture />);

    reportVisibility(container, (position) => (position === 3 ? 1 : 0));

    expect(screen.getByRole("link", { name: "3 枚目" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "1 枚目" })).not.toHaveAttribute("aria-current");
  });

  it("報告のない slide は見えていないものとして扱う", () => {
    const { container } = render(<ThumbnailFixture />);

    reportVisibility(container, (position) => (position === 2 ? 1 : -1));

    expect(screen.getByRole("link", { name: "2 枚目" })).toHaveAttribute("aria-current", "true");
  });

  it("現在地の link が一覧に収まっていれば一覧を動かさない", () => {
    const { container } = render(<ThumbnailFixture />);
    layOutStrip(container, 300, 60);

    reportVisibility(container, (position) => (position === 2 ? 1 : 0));

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("現在地の link が一覧の右へはみ出していれば一覧だけを送る", () => {
    const { container } = render(<ThumbnailFixture />);
    layOutStrip(container, 100, 60);

    reportVisibility(container, (position) => (position === 3 ? 1 : 0));

    expect(scrollBy).toHaveBeenCalledWith({ left: 80 });
  });

  it("現在地の link が一覧の左へはみ出していれば戻す", () => {
    const { container } = render(<ThumbnailFixture />);
    layOutStrip(container, 100, 60);
    const strip = screen.getByRole("list", { name: "画像の一覧" });

    strip.getBoundingClientRect = () => new DOMRect(120, 0, 100, 40);

    reportVisibility(container, (position) => (position === 1 ? 1 : 0));

    expect(scrollBy).toHaveBeenCalledWith({ left: -120 });
  });

  it("現在地に対応する link が一覧に無ければ一覧を動かさない", () => {
    const { container } = render(<ThumbnailFixture defaultCurrentId={missingSlideId} />);
    layOutStrip(container, 100, 60);

    expect(scrollBy).not.toHaveBeenCalled();
    expect(container.querySelector("[aria-current]")).toBeNull();
  });

  it("観測できる slide が無ければ観測を始めない", () => {
    render(<ThumbnailFixture visibleSlides={[]} />);

    expect(observed).toHaveLength(0);
  });

  it("Carousel の外に置かれた場合は追従しない", () => {
    render(
      <CarouselThumbnails aria-label="画像の一覧">
        <CarouselLink href="#どこでもない">1 枚目</CarouselLink>
      </CarouselThumbnails>,
    );

    expect(observed).toHaveLength(0);
    expect(screen.getByRole("link", { name: "1 枚目" })).not.toHaveAttribute("aria-current");
  });
});

describe("CarouselPrevious", () => {
  beforeEach(() => {
    scrollBy.mockClear();
    Element.prototype.scrollBy = scrollBy;
  });

  afterEach(() => {
    Element.prototype.scrollBy = originalScrollBy;
  });

  it("送り領域だけを横へ動かし、fragment 遷移は起こさない", async () => {
    const { container } = render(<StepFixture />);
    layOutSlides(container);
    const click = watchPreventDefault();

    await userEvent.click(linkIn("1 / 3", "次へ"));

    expect(click.prevented).toBe(true);
    expect(scrollBy).toHaveBeenCalledWith({ left: SLIDE_WIDTH });
  });

  it("末尾まで送ったあとの戻る向きは反対へ動かす", async () => {
    const { container } = render(<StepFixture />);
    layOutSlides(container, (SLIDES.length - 1) * SLIDE_WIDTH);

    await userEvent.click(linkIn("3 / 3", "前へ"));

    expect(scrollBy).toHaveBeenCalledWith({ left: -SLIDE_WIDTH });
  });

  it("見た目の円より広い当たり判定を持つ", () => {
    render(<StepFixture />);

    expect(linkIn("1 / 3", "次へ")).toHaveClass(
      "size-9",
      "after:absolute",
      "after:-inset-4.5",
    );
  });

  it("修飾キーを伴う押下は browser の既定動作に任せる", async () => {
    const { container } = render(<StepFixture />);
    layOutSlides(container);

    // 修飾キーの押下状態は同じ instance の中でしか続かない。呼び出しごとに作る既定の入口だと、
    // 押しっぱなしにしたつもりの Meta が click まで届かない。
    const user = userEvent.setup();
    const click = watchPreventDefault();

    await user.keyboard("{Meta>}");
    await user.click(linkIn("1 / 3", "次へ"));
    await user.keyboard("{/Meta}");

    expect(click.prevented).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("行き先の slide が無ければ既定動作に任せる", async () => {
    render(
      <CarouselItem aria-label="1 / 1">
        <CarouselNext href="#not-rendered" />
      </CarouselItem>,
    );

    const click = watchPreventDefault();

    await userEvent.click(screen.getByRole("link", { name: "次へ" }));

    expect(click.prevented).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("呼び出し元の onClick を先に呼び、そこで止められたら送らない", async () => {
    const onClick = vi.fn<MouseEventHandler<HTMLAnchorElement>>((event) => event.preventDefault());
    const { container } = render(<StepFixture onClick={onClick} />);
    layOutSlides(container);

    await userEvent.click(linkIn("1 / 3", "次へ"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<StepFixture />);

    expect(
      (
        await axe(container, {
          rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });
});

describe("CarouselNext", () => {
  beforeEach(() => {
    scrollBy.mockClear();
    Element.prototype.scrollBy = scrollBy;
  });

  afterEach(() => {
    Element.prototype.scrollBy = originalScrollBy;
  });

  it("次のスライドを指す link として slot つきで描画する", () => {
    render(<StepFixture />);

    expect(linkIn("1 / 3", "次へ")).toHaveAttribute(
      "data-slot",
      "carousel-next",
    );
  });

  it("呼び出し元の onClick も呼ぶ", async () => {
    const onClick = vi.fn();
    const { container } = render(<StepFixture onClick={onClick} />);
    layOutSlides(container);

    await userEvent.click(linkIn("1 / 3", "次へ"));

    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("CarouselLink", () => {
  beforeEach(() => {
    observed.length = 0;
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("スライドを指す link として slot つきで、slide の数だけ描画する", () => {
    const { container } = render(<ThumbnailFixture />);

    const links = container.querySelectorAll('[data-slot="carousel-link"]');

    expect(links).toHaveLength(SLIDES.length);
    expect(links[0]?.tagName).toBe("A");
  });
});

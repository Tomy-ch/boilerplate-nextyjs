// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { useId } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Carousel, CarouselContent, CarouselItem, CarouselNav } from "./carousel";
import { CarouselLink, CarouselNext, CarouselPrevious } from "./carousel-navigation";

const SLIDES = [1, 2, 3];

function SlidesFixture({ itemClassName }: { itemClassName?: string }) {
  return (
    <Carousel aria-label="サンプル画像">
      <CarouselContent>
        {SLIDES.map((position) => (
          <CarouselItem
            aria-label={`${position} / ${SLIDES.length}`}
            className={itemClassName}
            key={position}
          >
            内容 {position}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

function NavFixture() {
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
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselNav aria-label="サンプル画像の送り">
        {SLIDES.map((position) => (
          <CarouselLink href={`#${slideId}-${position}`} key={position}>
            {position}
          </CarouselLink>
        ))}
      </CarouselNav>
    </Carousel>
  );
}

function StepFixture() {
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
              <CarouselNext href={`#${slideId}-${position + 1}`} />
            ) : null}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

describe("Carousel", () => {
  it("carousel として読み替える、名前のある region を公開する", () => {
    render(<SlidesFixture />);

    const carousel = screen.getByRole("region", { name: "サンプル画像" });

    expect(carousel).toHaveAttribute("aria-roledescription", "carousel");
    expect(carousel).toHaveAttribute("data-slot", "carousel");
  });

  it("slide を group として公開し、全体のどこかを名前で伝える", () => {
    render(<SlidesFixture />);

    const slide = screen.getByRole("group", { name: "2 / 3" });

    expect(slide).toHaveAttribute("aria-roledescription", "slide");
    expect(slide).toHaveAttribute("data-slot", "carousel-item");
  });

  it("送り領域は keyboard で到達でき、スクロールを親へ連鎖させない", () => {
    const { container } = render(<SlidesFixture />);

    const content = container.querySelector('[data-slot="carousel-content"]');

    expect(content).toHaveAttribute("tabindex", "0");
    expect(content).toHaveClass("overscroll-x-contain");
  });

  it("中身が focus 可能な要素だけのときは送り領域の tab stop を外せる", () => {
    const { container } = render(
      <Carousel aria-label="サンプル画像">
        <CarouselContent tabIndex={-1}>
          <CarouselItem aria-label="1 / 1">
            <a href="#detail">詳細</a>
          </CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    expect(container.querySelector('[data-slot="carousel-content"]')).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("slide は既定で領域いっぱいを占め、className で複数枚ぶんの幅へ変えられる", () => {
    const { rerender } = render(<SlidesFixture />);

    expect(screen.getByRole("group", { name: "1 / 3" })).toHaveClass("basis-full");

    rerender(<SlidesFixture itemClassName="basis-1/2" />);

    expect(screen.getByRole("group", { name: "1 / 3" })).toHaveClass("basis-1/2");
  });

  it("送りの link を名前のある集合として公開する", () => {
    render(<NavFixture />);

    const nav = screen.getByRole("list", { name: "サンプル画像の送り" });

    expect(nav).toHaveAttribute("data-slot", "carousel-nav");
    expect(screen.getAllByRole("link")).toHaveLength(SLIDES.length);
  });

  it("先頭の送りは 1 枚目の slide を指す", () => {
    render(<NavFixture />);

    const href = screen.getByRole("link", { name: "1" }).getAttribute("href");
    const target = document.getElementById((href ?? "").slice(1));

    expect(target).toHaveAttribute("aria-roledescription", "slide");
    expect(target).toHaveAccessibleName(`1 / ${SLIDES.length}`);
  });

  it("末尾の送りは最後の slide を指す", () => {
    render(<NavFixture />);

    const href = screen.getByRole("link", { name: "3" }).getAttribute("href");
    const target = document.getElementById((href ?? "").slice(1));

    expect(target).toHaveAttribute("aria-roledescription", "slide");
    expect(target).toHaveAccessibleName(`3 / ${SLIDES.length}`);
  });

  it("端の送りは記号だけを描き、名前を aria-label で持つ", () => {
    render(<StepFixture />);

    expect(screen.getAllByRole("link", { name: "前へ" })).toHaveLength(SLIDES.length - 1);
    expect(screen.getAllByRole("link", { name: "次へ" })).toHaveLength(SLIDES.length - 1);
  });

  it("先頭の slide は前を持たず、次だけを指す", () => {
    render(<StepFixture />);
    const first = screen.getByRole("group", { name: "1 / 3" });

    expect(within(first).queryByRole("link", { name: "前へ" })).not.toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "次へ" })).toHaveAttribute(
      "href",
      `#${screen.getByRole("group", { name: "2 / 3" }).id}`,
    );
  });

  it("中間の slide は前後どちらの slide も指す", () => {
    render(<StepFixture />);
    const middle = screen.getByRole("group", { name: "2 / 3" });

    expect(within(middle).getByRole("link", { name: "前へ" })).toHaveAttribute(
      "href",
      `#${screen.getByRole("group", { name: "1 / 3" }).id}`,
    );
    expect(within(middle).getByRole("link", { name: "次へ" })).toHaveAttribute(
      "href",
      `#${screen.getByRole("group", { name: "3 / 3" }).id}`,
    );
  });

  it("末尾の slide は次を持たず、前だけを指す", () => {
    render(<StepFixture />);
    const last = screen.getByRole("group", { name: "3 / 3" });

    expect(within(last).getByRole("link", { name: "前へ" })).toHaveAttribute(
      "href",
      `#${screen.getByRole("group", { name: "2 / 3" }).id}`,
    );
    expect(within(last).queryByRole("link", { name: "次へ" })).not.toBeInTheDocument();
  });

  it("端の送りの名前を呼び出し元が言い換えられる", () => {
    render(
      <CarouselItem aria-label="1 / 2">
        <CarouselNext aria-label="次の画像へ" href="#next" />
      </CarouselItem>,
    );

    expect(screen.getByRole("link", { name: "次の画像へ" })).toHaveAttribute("href", "#next");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<NavFixture />);

    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });

  it("端の送りを置いても a11y 自動検査に違反しない", async () => {
    const { container } = render(<StepFixture />);

    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });
});

describe("CarouselContent", () => {
  it("スライドを並べる枠として slot を持つ要素を描画する", () => {
    const { container } = render(<SlidesFixture />);

    expect(container.querySelector('[data-slot="carousel-content"]')).not.toBeNull();
  });
});

describe("CarouselItem", () => {
  it("スライド 1 件として slot を持つ要素を、名前つきで描画する", () => {
    render(<SlidesFixture />);

    const item = screen.getByRole("group", { name: `1 / ${SLIDES.length}` });

    expect(item).toHaveAttribute("data-slot", "carousel-item");
  });

  it("呼び出し側の class を既定の指定へ足す", () => {
    render(<SlidesFixture itemClassName="basis-1/2" />);

    expect(screen.getByRole("group", { name: `1 / ${SLIDES.length}` })).toHaveClass("basis-1/2");
  });
});

describe("CarouselNav", () => {
  it("操作の枠として slot を持つ要素を描画する", () => {
    const { container } = render(<NavFixture />);

    expect(container.querySelector('[data-slot="carousel-nav"]')).not.toBeNull();
  });
});

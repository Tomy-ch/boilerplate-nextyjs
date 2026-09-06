// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { UnsavedChangesGuard, useUnsavedChanges } from "./unsaved-changes-guard";

const guard = vi.hoisted(() => ({ when: false }));
const unload = vi.hoisted(() => ({ when: false }));

vi.mock("@/components/app-starter/navigation-guard/navigation-guard", () => ({
  NavigationGuard: ({ children, when }: { children: ReactNode; when: boolean }) => {
    guard.when = when;

    return children;
  },
}));

vi.mock("@/components/app-starter/unload-guard/unload-guard", () => ({
  UnloadGuard: ({ when }: { when: boolean }) => {
    unload.when = when;

    return null;
  },
}));

/** 申告する側の画面。 */
function Declaring({ hasUnsavedChanges }: { hasUnsavedChanges: boolean }) {
  useUnsavedChanges(hasUnsavedChanges);

  return <p>画面</p>;
}

describe("UnsavedChangesGuard", () => {
  it("申告が無ければ、離れる操作を止めない", () => {
    render(
      <UnsavedChangesGuard>
        <Declaring hasUnsavedChanges={false} />
      </UnsavedChangesGuard>,
    );

    expect(guard.when).toBe(false);
    expect(unload.when).toBe(false);
  });

  it("書きかけの申告を受けると、アプリ内の移動と離脱の両方を見張る", () => {
    render(
      <UnsavedChangesGuard>
        <Declaring hasUnsavedChanges={true} />
      </UnsavedChangesGuard>,
    );

    expect(guard.when).toBe(true);
    expect(unload.when).toBe(true);
  });

  it("包んだ中身をそのまま出す", () => {
    render(
      <UnsavedChangesGuard>
        <Declaring hasUnsavedChanges={false} />
      </UnsavedChangesGuard>,
    );

    expect(screen.getByText("画面")).toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない。包んだだけで支援技術への見え方を変えない", async () => {
    const { container } = render(
      <UnsavedChangesGuard>
        <Declaring hasUnsavedChanges={false} />
      </UnsavedChangesGuard>,
    );

    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });
});

describe("useUnsavedChanges", () => {
  it("書きかけがあることを器へ申告する", () => {
    render(
      <UnsavedChangesGuard>
        <Declaring hasUnsavedChanges={true} />
      </UnsavedChangesGuard>,
    );

    expect(guard.when).toBe(true);
  });

  it("申告した画面が外れたら、申告も取り下げる", () => {
    const { rerender } = render(
      <UnsavedChangesGuard>
        <Declaring hasUnsavedChanges={true} />
      </UnsavedChangesGuard>,
    );

    expect(guard.when).toBe(true);

    rerender(
      <UnsavedChangesGuard>
        <p>別の画面</p>
      </UnsavedChangesGuard>,
    );

    expect(guard.when).toBe(false);
  });

  it("器の外で申告されても壊れない", () => {
    expect(() => render(<Declaring hasUnsavedChanges={true} />)).not.toThrow();
    expect(screen.getByText("画面")).toBeInTheDocument();
  });
});

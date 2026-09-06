// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { ButtonVariant } from "@/components/design-system/action/button/button.definition";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { ErrorKind } from "@/errors/error-kind";
import type { ActionState } from "@/model/action-state";
import { failedActionState, idleActionState, succeededActionState } from "@/model/action-state";

import { PurchaseTransitionButton } from "./transition-button";

const PURCHASE_CODE = "0195f0c2-0000-7000-9000-000000000001";
const RELOAD_HREF = `/purchases/${PURCHASE_CODE}`;

/** 既定の props。個々のケースは、ここから必要な 1 つだけ差し替える。 */
function renderButton(
  overrides: Partial<{
    state: ActionState<undefined>;
    variant: ButtonVariant;
    confirmVariant: ButtonVariant;
    formAction: (formData: FormData) => void;
  }> = {},
) {
  const formAction = overrides.formAction ?? vi.fn();

  render(
    <PurchaseTransitionButton
      confirmDescription="この注文を取り消します。元に戻すことはできません。"
      confirmTitle="この注文をキャンセルしますか？"
      failureTitle="キャンセルできませんでした"
      formAction={formAction}
      label="キャンセルする"
      pendingLabel="キャンセルしています…"
      purchaseCode={PURCHASE_CODE}
      reloadHref={RELOAD_HREF}
      state={overrides.state ?? idleActionState()}
      {...(overrides.variant === undefined ? {} : { variant: overrides.variant })}
      {...(overrides.confirmVariant === undefined
        ? {}
        : { confirmVariant: overrides.confirmVariant })}
    />,
  );

  return { formAction };
}

/** 確認を開く。 */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "キャンセルする" }));

  return screen.findByRole("alertdialog");
}

describe("PurchaseTransitionButton", () => {
  it("既定では確認を開かず、押せる操作だけを出す", () => {
    renderButton();

    expect(screen.getByRole("button", { name: "キャンセルする" })).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("開く操作と確定操作で、別の見た目を指定できる", async () => {
    const user = userEvent.setup();
    renderButton({
      variant: BUTTON_VARIANT.OUTLINE,
      confirmVariant: BUTTON_VARIANT.DESTRUCTIVE,
    });

    expect(screen.getByRole("button", { name: "キャンセルする" })).toHaveClass("border-border");

    const dialog = await open(user);

    expect(within(dialog).getByRole("button", { name: "キャンセルする" })).toHaveClass(
      "bg-destructive",
    );
  });

  it("確定操作の見た目を省くと、開く操作に揃う", async () => {
    const user = userEvent.setup();
    renderButton({ variant: BUTTON_VARIANT.OUTLINE });

    const dialog = await open(user);

    expect(within(dialog).getByRole("button", { name: "キャンセルする" })).toHaveClass(
      "border-border",
    );
  });

  it("押すと、起きることと戻せるかどうかを確認で伝える", async () => {
    const user = userEvent.setup();
    renderButton();

    const dialog = await open(user);

    expect(within(dialog).getByText("この注文をキャンセルしますか？")).toBeVisible();
    expect(within(dialog).getByText(/元に戻すことはできません/)).toBeVisible();
  });

  it("対象の購入を送信に載せる", async () => {
    const user = userEvent.setup();
    renderButton();

    const dialog = await open(user);
    const hidden = within(dialog).getByDisplayValue(PURCHASE_CODE);

    expect(hidden).toHaveAttribute("name", "purchaseCode");
  });

  it("成立したことは伝えない", async () => {
    const user = userEvent.setup();
    renderButton({ state: succeededActionState(undefined) });

    const dialog = await open(user);

    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("送信中は押せなくなり、進行中であることを文言で示す", async () => {
    const user = userEvent.setup();
    let settle: (() => void) | undefined;

    renderButton({
      formAction: () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    });

    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "キャンセルする" }));

    const pending = await within(dialog).findByRole("button", {
      name: "キャンセルしています…",
    });

    expect(pending).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "キャンセルする" })).not.toBeInTheDocument();

    settle?.();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "キャンセルする" })).toBeEnabled(),
    );
  });

  it("a11y 自動検査に違反しない", async () => {
    const user = userEvent.setup();
    renderButton();

    await open(user);

    expect((await axe(document.body)).violations).toEqual([]);
  });

  it("通らなかったことを確認の中で伝える", async () => {
    const user = userEvent.setup();
    renderButton({
      state: failedActionState({ formError: "いまの状況ではキャンセルできません。" }),
    });

    const dialog = await open(user);

    expect(within(dialog).getByText("キャンセルできませんでした")).toBeVisible();
    expect(within(dialog).getByText("いまの状況ではキャンセルできません。")).toBeVisible();
  });

  it("状況で拒まれたときは、読み込み直す導線を添える", async () => {
    const user = userEvent.setup();
    renderButton({
      state: failedActionState({ formError: "いまの状況では…", kind: ErrorKind.CONFLICT }),
    });

    const dialog = await open(user);

    expect(within(dialog).getByRole("link", { name: "読み込み直す" })).toHaveAttribute(
      "href",
      RELOAD_HREF,
    );
  });

  it("状況以外の理由で通らなかったときは、読み込み直す導線を出さない", async () => {
    const user = userEvent.setup();
    renderButton({
      state: failedActionState({ formError: "問題が発生しました。", kind: ErrorKind.INTERNAL }),
    });

    const dialog = await open(user);

    expect(within(dialog).queryByRole("link", { name: "読み込み直す" })).not.toBeInTheDocument();
  });

  it("文言の無い失敗では何も出さない", async () => {
    const user = userEvent.setup();
    renderButton({ state: failedActionState({ formError: null }) });

    const dialog = await open(user);

    expect(within(dialog).queryByText("キャンセルできませんでした")).not.toBeInTheDocument();
  });
});

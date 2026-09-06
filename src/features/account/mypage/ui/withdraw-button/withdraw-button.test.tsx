// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { failedActionState } from "@/model/action-state";

const { withdrawAction } = vi.hoisted(() => ({ withdrawAction: vi.fn() }));

vi.mock("../../../actions", () => ({ withdrawAction }));

import { WithdrawButton } from "./withdraw-button";

const CONFLICT_MESSAGE = "進行中の購入が残っているため退会できません。";

/** 確認 dialog を開く。 */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "退会する" }));

  return screen.findByRole("alertdialog");
}

/** dialog の中の実行ボタン。開く前の trigger と名前が同じなので dialog の内側から引く。 */
function confirmButton(dialog: HTMLElement) {
  return within(dialog).getByRole("button", { name: "退会する" });
}

beforeEach(() => {
  withdrawAction.mockReset();
  withdrawAction.mockResolvedValue(failedActionState({ formError: CONFLICT_MESSAGE }));
});

describe("WithdrawButton", () => {
  it("既定では確認を開かず、押せる操作だけを出す", () => {
    render(<WithdrawButton />);

    expect(screen.getByRole("button", { name: "退会する" })).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("押すと戻せない操作であることを確認で伝える", async () => {
    const user = userEvent.setup();

    render(<WithdrawButton />);
    const dialog = await open(user);

    expect(within(dialog).getByText("退会してもよろしいですか？")).toBeVisible();
    expect(within(dialog).getByText(/元に戻すことはできません/)).toBeVisible();
  });

  it("即時に反映されるとは書かず、順次処理されることを伝える", async () => {
    const user = userEvent.setup();

    render(<WithdrawButton />);
    const dialog = await open(user);

    expect(within(dialog).getByText(/順次処理されるため/)).toBeVisible();
  });

  it("進行中の購入があると退会できないことを先に伝える", async () => {
    const user = userEvent.setup();

    render(<WithdrawButton />);
    const dialog = await open(user);

    expect(within(dialog).getByText(/進行中の購入が残っている場合は退会できません/)).toBeVisible();
  });

  it("実行を submit にして、押した時点で dialog を閉じない", async () => {
    const user = userEvent.setup();

    render(<WithdrawButton />);
    const dialog = await open(user);

    expect(confirmButton(dialog)).toHaveAttribute("type", "submit");
  });

  it("取り消しは送信せずに閉じる", async () => {
    const user = userEvent.setup();

    render(<WithdrawButton />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole("button", { name: "キャンセル" }));

    expect(withdrawAction).not.toHaveBeenCalled();
  });

  it("実行すると退会を送る", async () => {
    const user = userEvent.setup();

    render(<WithdrawButton />);
    const dialog = await open(user);
    await user.click(confirmButton(dialog));

    expect(withdrawAction).toHaveBeenCalledOnce();
  });

  it("退会できなかったとき理由を利用者が見ている場所へ出す", async () => {
    const user = userEvent.setup();

    render(<WithdrawButton />);
    const dialog = await open(user);
    await user.click(confirmButton(dialog));

    expect(await screen.findByText("退会できませんでした")).toBeVisible();
    expect(screen.getByText(CONFLICT_MESSAGE)).toBeVisible();
  });

  it("送信中は押せなくなり、進行中であることを文言で示す", async () => {
    const user = userEvent.setup();
    let settle: (() => void) | undefined;

    withdrawAction.mockReturnValue(
      new Promise((resolve) => {
        settle = () => resolve(failedActionState({ formError: CONFLICT_MESSAGE }));
      }),
    );

    render(<WithdrawButton />);
    const dialog = await open(user);
    await user.click(confirmButton(dialog));

    const pending = await within(dialog).findByRole("button", { name: "退会しています…" });

    expect(pending).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "退会する" })).not.toBeInTheDocument();

    settle?.();
    expect(await screen.findByText("退会できませんでした")).toBeVisible();
  });

  it("送信していない間は失敗の文言を出さない", () => {
    render(<WithdrawButton />);

    expect(screen.queryByText("退会できませんでした")).not.toBeInTheDocument();
  });

  it("退会できなかった理由が無ければ、見出しごと出さない", async () => {
    const user = userEvent.setup();

    withdrawAction.mockResolvedValue(failedActionState({}));

    render(<WithdrawButton />);
    const dialog = await open(user);
    await user.click(confirmButton(dialog));

    await waitFor(() => expect(withdrawAction).toHaveBeenCalled());

    expect(screen.queryByText("退会できませんでした")).not.toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<WithdrawButton />);

    await open(user);

    expect((await axe(baseElement)).violations).toEqual([]);
  });
});

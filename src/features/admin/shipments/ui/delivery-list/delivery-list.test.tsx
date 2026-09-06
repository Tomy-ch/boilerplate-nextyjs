// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ErrorKind } from "@/errors/error-kind";
import { failedActionState, succeededActionState } from "@/model/action-state";

import { DELIVERY_CONFLICT_MESSAGE } from "../../form-state";
import { SHIPPED_PURCHASES } from "../../shipments.fixture";
import { DeliveryListCard } from "./delivery-list";

const deliverAction = vi.fn();

/** 送信に載った購入コードを、届いた順に取り出す。 */
function submittedCodes(call: number): readonly string[] {
  const formData = deliverAction.mock.calls[call]?.[1];

  return formData instanceof FormData ? formData.getAll("purchaseCode").map(String) : [];
}

/** 並んでいる確認の操作を、上から数えて取り出す。 */
function deliverActionAt(index: number): HTMLElement {
  const controls = screen.getAllByRole("button", { name: "配達済みにする" });
  const control = controls[index];

  if (control === undefined) {
    throw new Error(`${index} 番目の配達の確認操作が見つかりません`);
  }

  return control;
}

beforeEach(() => {
  deliverAction.mockReset();
  deliverAction.mockResolvedValue(
    succeededActionState({ purchaseCode: SHIPPED_PURCHASES[0]?.code ?? "" }),
  );
});

describe("DeliveryListCard", () => {
  it("発送済みの注文を、受け取った順で並べる", () => {
    render(<DeliveryListCard deliverAction={deliverAction} purchases={SHIPPED_PURCHASES} />);

    const codes = screen.getAllByText(/^0195f0c2-0000-7000-9000-00000000001/);

    expect(codes.map((element) => element.textContent)).toEqual(
      SHIPPED_PURCHASES.map(({ code }) => code),
    );
  });

  it("注文ごとに 1 つずつ確認の操作を出す", () => {
    render(<DeliveryListCard deliverAction={deliverAction} purchases={SHIPPED_PURCHASES} />);

    expect(screen.getAllByRole("button", { name: "配達済みにする" })).toHaveLength(
      SHIPPED_PURCHASES.length,
    );
  });

  it("押した注文の購入コードだけを送る", async () => {
    render(<DeliveryListCard deliverAction={deliverAction} purchases={SHIPPED_PURCHASES} />);

    await userEvent.click(deliverActionAt(1));

    expect(submittedCodes(0)).toEqual([SHIPPED_PURCHASES[1]?.code]);
  });

  it("通ったら、どの注文を確認したのかを述べる", async () => {
    render(<DeliveryListCard deliverAction={deliverAction} purchases={SHIPPED_PURCHASES} />);

    await userEvent.click(deliverActionAt(0));

    expect(await screen.findByText("配達を確認しました")).toBeVisible();
  });

  it("配達を待っている注文が無ければ、その旨を述べる", () => {
    render(<DeliveryListCard deliverAction={deliverAction} purchases={[]} />);

    expect(screen.getByText("配達の確認を待っている注文はありません。")).toBeVisible();
    expect(screen.queryByRole("button", { name: "配達済みにする" })).not.toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(
      <DeliveryListCard deliverAction={deliverAction} purchases={SHIPPED_PURCHASES} />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });

  it("通らなかったら、確認できなかったことを述べる", async () => {
    deliverAction.mockResolvedValueOnce(
      failedActionState({ formError: DELIVERY_CONFLICT_MESSAGE, kind: ErrorKind.CONFLICT }),
    );

    render(<DeliveryListCard deliverAction={deliverAction} purchases={SHIPPED_PURCHASES} />);

    await userEvent.click(deliverActionAt(0));

    expect(await screen.findByText("配達済みにできませんでした")).toBeVisible();
    expect(screen.getByText(DELIVERY_CONFLICT_MESSAGE)).toBeVisible();
  });

  it("確認している間は、押した行だけを押せなくする", async () => {
    let settle: ((state: unknown) => void) | undefined;

    deliverAction.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );

    render(<DeliveryListCard deliverAction={deliverAction} purchases={SHIPPED_PURCHASES} />);

    await userEvent.click(deliverActionAt(0));

    const pending = await screen.findByRole("button", { name: "確認しています…" });

    expect(pending).toBeDisabled();

    for (const control of screen.getAllByRole("button", { name: "配達済みにする" })) {
      expect(control).toBeEnabled();
    }

    settle?.(succeededActionState({ purchaseCode: SHIPPED_PURCHASES[0]?.code ?? "" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "確認しています…" })).not.toBeInTheDocument(),
    );
  });

  it("通らなかった理由が無ければ、何も述べない", async () => {
    deliverAction.mockResolvedValueOnce(failedActionState({ kind: ErrorKind.CONFLICT }));

    render(<DeliveryListCard deliverAction={deliverAction} purchases={SHIPPED_PURCHASES} />);

    await userEvent.click(deliverActionAt(0));

    await waitFor(() => expect(deliverAction).toHaveBeenCalledOnce());

    expect(screen.queryByText("配達済みにできませんでした")).not.toBeInTheDocument();
    expect(screen.queryByText("配達を確認しました")).not.toBeInTheDocument();
  });
});

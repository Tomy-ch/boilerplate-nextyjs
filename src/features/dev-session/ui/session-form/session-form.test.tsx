// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { failedActionState, idleActionState } from "@/model/action-state";

import { AUTHORIZE_ERROR } from "../../authorize-error";
import type { IssueDevSessionAction } from "../../form-state";
import { DevSessionForm } from "./session-form";

/** 何も起きない送信先。表示だけを見る試験で使う。 */
const issue: IssueDevSessionAction = async () => idleActionState();

describe("DevSessionForm", () => {
  it("認可の往復の途中なら、認可 endpoint へ素の form で送る", () => {
    const { container } = render(
      <DevSessionForm
        action={issue}
        authorization={{ state: "tx-state", notice: null }}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    const form = container.querySelector("form");

    expect(form).toHaveAttribute("action", "/dev/session/authorize");
    expect(form).toHaveAttribute("method", "post");
  });

  it("直接開かれたなら、送信先を属性に出さない", () => {
    const { container } = render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(container.querySelector("form")).not.toHaveAttribute("method", "post");
  });

  it("取りに行けなかった理由も、その文言で出す", () => {
    render(
      <DevSessionForm
        action={issue}
        authorization={{ state: "tx-state", notice: AUTHORIZE_ERROR.UNAVAILABLE }}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(
      screen.getByText(
        "IdP からトークンを取れませんでした。接続先を確かめてから、もう一度お試しください。",
      ),
    ).toBeVisible();
  });

  it("URL から届いた理由を、送信の下に出す", () => {
    render(
      <DevSessionForm
        action={issue}
        authorization={{ state: "tx-state", notice: AUTHORIZE_ERROR.INVALID }}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(screen.getByText("発行の指定を確認してください。")).toBeVisible();
  });

  it("認可の往復の途中なら、対応づける値を送信へ載せる", () => {
    const { container } = render(
      <DevSessionForm
        action={issue}
        authorization={{ state: "tx-state", notice: null }}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(container.querySelector('input[name="state"]')).toHaveValue("tx-state");
  });

  it("直接開かれたなら、対応づける値を送信へ載せない", () => {
    const { container } = render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(container.querySelector('input[name="state"]')).toBeNull();
  });

  it("発行の指定を並べる", () => {
    render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(screen.getByLabelText("誰として入るか")).toHaveValue("dev-user");
    expect(screen.getByLabelText("失効までの秒数")).toHaveValue("3600");
    expect(screen.getByLabelText("Access Token（任意）")).toHaveValue("");
  });

  it("役割は一般利用者を既定にする", () => {
    render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(screen.getByRole("radio", { name: "一般利用者" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "管理者" })).not.toBeChecked();
  });

  it("戻り先を送信へ載せる", () => {
    const { container } = render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/account"
      />,
    );

    expect(container.querySelector('input[name="returnUrl"]')).toHaveValue("/account");
  });

  it("発行している間は、押せなくしたうえで進行を読み上げる", async () => {
    const user = userEvent.setup();
    let settle: (() => void) | undefined;
    const pendingIssue: IssueDevSessionAction = () =>
      new Promise((resolve) => {
        settle = () => resolve(idleActionState());
      });

    render(
      <DevSessionForm
        action={pendingIssue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );
    await user.click(screen.getByRole("button", { name: "この内容で入る" }));

    expect(await screen.findByRole("button", { name: "session を発行しています" })).toBeDisabled();

    settle?.();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "この内容で入る" })).toBeEnabled(),
    );
  });
  it("項目ごとの理由は、その項目の隣に出す", async () => {
    const user = userEvent.setup();
    const failingIssue: IssueDevSessionAction = async () =>
      failedActionState({
        fieldErrors: {
          accessToken: ["トークンの形が違います。"],
          expiresInSeconds: ["秒数は 1 以上で指定してください。"],
          subject: ["誰として入るかを指定してください。"],
        },
      });

    render(
      <DevSessionForm
        action={failingIssue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );
    await user.click(screen.getByRole("button", { name: "この内容で入る" }));

    expect(await screen.findByText("誰として入るかを指定してください。")).toBeVisible();
    expect(screen.getByText("秒数は 1 以上で指定してください。")).toBeVisible();
    expect(screen.getByText("トークンの形が違います。")).toBeVisible();

    for (const label of ["誰として入るか", "失効までの秒数", "Access Token（任意）"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("aria-invalid", "true");
    }

    expect(screen.queryByText("session を発行できませんでした")).not.toBeInTheDocument();
  });

  it("認可の理由も送信の理由も無ければ、送信の下に何も出さない", () => {
    render(
      <DevSessionForm
        action={issue}
        authorization={{ state: "tx-state", notice: null }}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(screen.queryByText("session を発行できませんでした")).not.toBeInTheDocument();
  });

  it("実物の API へ繋ぐとき、接続先の理由もその欄の隣に出す", async () => {
    const user = userEvent.setup();
    const failingIssue: IssueDevSessionAction = async () =>
      failedActionState({ fieldErrors: { issuerUrl: ["接続先の形が違います。"] } });

    render(
      <DevSessionForm
        action={failingIssue}
        authorization={null}
        connectsLiveApi
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );
    await user.click(screen.getByRole("button", { name: "この内容で入る" }));

    expect(await screen.findByText("接続先の形が違います。")).toBeVisible();
    expect(screen.getByLabelText("IdP の接続先")).toHaveAttribute("aria-invalid", "true");
  });

  it("理由の届いていない項目には印を付けない", async () => {
    const user = userEvent.setup();
    const failingIssue: IssueDevSessionAction = async () =>
      failedActionState({ fieldErrors: { subject: ["誰として入るかを指定してください。"] } });

    render(
      <DevSessionForm
        action={failingIssue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );
    await user.click(screen.getByRole("button", { name: "この内容で入る" }));

    expect(await screen.findByText("誰として入るかを指定してください。")).toBeVisible();
    expect(screen.getByLabelText("失効までの秒数")).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByLabelText("Access Token（任意）")).toHaveAttribute("aria-invalid", "false");
  });

  it("項目に紐づかない理由は、操作の隣に出す", async () => {
    const user = userEvent.setup();
    const failingIssue: IssueDevSessionAction = async () =>
      failedActionState({ formError: "この口は、開発と CI の手元の宛先でだけ開きます。" });

    render(
      <DevSessionForm
        action={failingIssue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );
    await user.click(screen.getByRole("button", { name: "この内容で入る" }));

    expect(await screen.findByText("session を発行できませんでした")).toBeVisible();
    expect(screen.getByText("この口は、開発と CI の手元の宛先でだけ開きます。")).toBeVisible();
  });

  it("貼ったトークンを読み返す口を持たない", () => {
    render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(screen.getByLabelText("Access Token（任意）")).toHaveAttribute("name", "accessToken");
    expect(screen.queryByText(/いまのトークン/)).not.toBeInTheDocument();
  });

  it("実物の API へ繋いでいるときは、取りに行く指定を既定にする", () => {
    render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(screen.getByLabelText("API 接続モード")).toBeChecked();
  });

  it("モックへ繋いでいるときは、取りに行かない", () => {
    render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(screen.getByLabelText("API 接続モード")).not.toBeChecked();
  });

  it("取りに行く間は、貼る欄を出さない", () => {
    render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect(screen.queryByLabelText("Access Token（任意）")).not.toBeInTheDocument();
  });

  it("取りに行くのをやめると、貼る欄が戻る", async () => {
    const user = userEvent.setup();

    render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );
    await user.click(screen.getByLabelText("API 接続モード"));

    expect(screen.getByLabelText("Access Token（任意）")).toBeVisible();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(
      <DevSessionForm
        action={issue}
        authorization={null}
        connectsLiveApi={false}
        defaultIssuer="https://idp.example.test"
        returnUrl="/"
      />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});

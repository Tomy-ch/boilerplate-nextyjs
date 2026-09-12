// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOnlineStatus } from "./use-online-status";

/** jsdom の `navigator.onLine` は読み取り専用なので、値と通知を手元で制御できる形へ差し替える。 */
function stubOnLine(initial: boolean) {
  const state = { online: initial };

  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => state.online);

  return {
    change(online: boolean) {
      state.online = online;
      globalThis.dispatchEvent(new Event(online ? "online" : "offline"));
    },
  };
}

function Probe() {
  const online = useOnlineStatus();

  return <p>{online ? "繋がっている" : "繋がっていない"}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useOnlineStatus", () => {
  // ----- 正常系 -----
  it("繋がっていれば真を返す", () => {
    stubOnLine(true);
    render(<Probe />);

    expect(screen.getByText("繋がっている")).toBeInTheDocument();
  });

  it("繋がっていなければ偽を返す", () => {
    stubOnLine(false);
    render(<Probe />);

    expect(screen.getByText("繋がっていない")).toBeInTheDocument();
  });

  it("切れたことを受け取る", () => {
    const network = stubOnLine(true);

    render(<Probe />);
    act(() => network.change(false));

    expect(screen.getByText("繋がっていない")).toBeInTheDocument();
  });

  it("戻ったことを受け取る", () => {
    const network = stubOnLine(false);

    render(<Probe />);
    act(() => network.change(true));

    expect(screen.getByText("繋がっている")).toBeInTheDocument();
  });

  it("外したら通知の口を残さない", () => {
    stubOnLine(true);

    const removeEventListener = vi.spyOn(globalThis, "removeEventListener");
    const { unmount } = render(<Probe />);

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("offline", expect.any(Function));
  });

  it("サーバでは繋がっている側を返す", () => {
    expect(renderToStaticMarkup(<Probe />)).toContain("繋がっている");
  });
});

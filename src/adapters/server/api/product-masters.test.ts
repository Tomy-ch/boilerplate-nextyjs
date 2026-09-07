import { afterEach, describe, expect, it, vi } from "vitest";
import { PARSED_ENVIRONMENT } from "@/config/environment.fixture";
import { serveJson } from "../../../../vitest.setup.msw";

const { getEnvironment } = vi.hoisted(() => ({ getEnvironment: vi.fn(() => PARSED_ENVIRONMENT) }));
const { cacheLife, cacheTag } = vi.hoisted(() => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

vi.mock("@/config/environment", () => ({ getEnvironment }));
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

import { getProductCategories, getProductStatuses, PRODUCT_MASTERS_TAG } from "./product-masters";

const wireCategories = [
  { id: "3f4b2f2e-6a3f-4c4a-9e6e-2b1d8f2a1b21", name: "雑貨", code: 20, displaySort: 1 },
  { id: "3f4b2f2e-6a3f-4c4a-9e6e-2b1d8f2a1b22", name: "書籍", code: 10, displaySort: 2 },
];

const wireStatuses = [
  { id: "3f4b2f2e-6a3f-4c4a-9e6e-2b1d8f2a1b31", name: "在庫あり", code: 1 },
  { id: "3f4b2f2e-6a3f-4c4a-9e6e-2b1d8f2a1b32", name: "在庫切れ", code: 2 },
];

const CATEGORIES_URL = `${PARSED_ENVIRONMENT.APP_API_BASE_URL}/v1/products/categories`;
const STATUSES_URL = `${PARSED_ENVIRONMENT.APP_API_BASE_URL}/v1/products/statuses`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getProductCategories", () => {
  // ----- 正常系 -----
  it("契約の応答から ID・コード・表示名だけを取り出す", async () => {
    serveJson(CATEGORIES_URL, wireCategories);

    await expect(getProductCategories()).resolves.toEqual([
      { id: wireCategories[0]?.id, code: 20, name: "雑貨" },
      { id: wireCategories[1]?.id, code: 10, name: "書籍" },
    ]);
  });

  it("契約が返した並びをそのまま保つ", async () => {
    serveJson(CATEGORIES_URL, wireCategories);

    const categories = await getProductCategories();

    expect(categories.map(({ name }) => name)).toEqual(["雑貨", "書籍"]);
  });

  it("カテゴリのマスタへ問い合わせる", async () => {
    const requests = serveJson(CATEGORIES_URL, wireCategories);

    await getProductCategories();

    expect(requests[0]?.url).toBe(CATEGORIES_URL);
  });

  it("マスタの寿命と再検証タグを宣言する", async () => {
    serveJson(CATEGORIES_URL, wireCategories);

    await getProductCategories();

    expect(cacheLife).toHaveBeenCalledWith("masters");
    expect(cacheTag).toHaveBeenCalledWith(PRODUCT_MASTERS_TAG);
  });

  it("取得そのものには寿命を持たせない", async () => {
    serveJson(CATEGORIES_URL, wireCategories);
    const fetchImpl = vi.spyOn(globalThis, "fetch");

    await getProductCategories();

    expect(fetchImpl.mock.calls[0]?.[1]).not.toMatchObject({ cache: "force-cache" });
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty("next.tags");
  });

  it("マスタが空でも空の一覧を返す", async () => {
    serveJson(CATEGORIES_URL, []);

    await expect(getProductCategories()).resolves.toEqual([]);
  });
});

describe("getProductStatuses", () => {
  // ----- 正常系 -----
  it("契約の応答から ID・コード・表示名を取り出す", async () => {
    serveJson(STATUSES_URL, wireStatuses);

    await expect(getProductStatuses()).resolves.toEqual([
      { id: wireStatuses[0]?.id, name: "在庫あり", code: 1 },
      { id: wireStatuses[1]?.id, name: "在庫切れ", code: 2 },
    ]);
  });

  it("契約が返した並びをそのまま保つ", async () => {
    serveJson(STATUSES_URL, [wireStatuses[1], wireStatuses[0]]);

    const statuses = await getProductStatuses();

    expect(statuses.map((status) => status.name)).toEqual(["在庫切れ", "在庫あり"]);
  });

  it("状態のマスタへ問い合わせる", async () => {
    const requests = serveJson(STATUSES_URL, wireStatuses);

    await getProductStatuses();

    expect(requests[0]?.url).toBe(STATUSES_URL);
  });

  it("カテゴリと同じ寿命を名乗り、同じ再検証タグを付ける", async () => {
    serveJson(STATUSES_URL, wireStatuses);

    await getProductStatuses();

    expect(cacheLife).toHaveBeenCalledWith("masters");
    expect(cacheTag).toHaveBeenCalledWith(PRODUCT_MASTERS_TAG);
  });

  it("取得そのものには寿命を持たせない", async () => {
    serveJson(STATUSES_URL, wireStatuses);
    const fetchImpl = vi.spyOn(globalThis, "fetch");

    await getProductStatuses();

    expect(fetchImpl.mock.calls[0]?.[1]).not.toMatchObject({ cache: "force-cache" });
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty("next.tags");
  });

  it("マスタが空でも空の一覧を返す", async () => {
    serveJson(STATUSES_URL, []);

    await expect(getProductStatuses()).resolves.toEqual([]);
  });
});

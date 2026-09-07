import type { ProductListItem, ProductRankingEntry } from "@/model/product/product";
import { withScreenSpan } from "@/observability/render-span";
import { NewArrivals } from "./ui/new-arrivals/new-arrivals";
import { RankingList } from "./ui/ranking-list/ranking-list";
import { SectionFailure } from "./ui/section-failure/section-failure";

/**
 * 1 つの節の取得結果。
 *
 * @remarks
 * 失敗を例外ではなく値で持ちます。トップは系統ごとに成否が分かれる画面なので、投げてしまうと
 * 最初に落ちた 1 つが残りを道連れにします。
 */
export type SectionState<T> =
  | { readonly status: "ready"; readonly value: T }
  | { readonly status: "failed"; readonly message: string };

/** `HomeView` の props。 */
export type HomeViewProps = {
  /** 新着商品。 */
  newArrivals: SectionState<readonly ProductListItem[]>;
  /** 売れ筋ランキング。 */
  ranking: SectionState<readonly ProductRankingEntry[]>;
};

/**
 * 要求ごとに取る 2 節。
 *
 * @remarks
 * 取得を持ちません。節を受け取って積むだけにしてあるのは、節ごとの成否の組み合わせを取得なしで
 * 確かめられるようにするためです。
 *
 * 節の並びは、画像のある帯・行の帯の順です。同じ密度の帯が続くと、どこまでが 1 つの節なのかが
 * 読み取りにくくなります。3 つ目の帯（分類）はこの器の外、静的な殻の側に居ます
 * （[categories-content.tsx](./categories-content.tsx)）。
 */
export const HomeView = withScreenSpan(
  "features/home/view",
  ({ newArrivals, ranking }: HomeViewProps) => {
    return (
      <>
        {newArrivals.status === "ready" ? (
          <NewArrivals items={newArrivals.value} />
        ) : (
          <SectionFailure label="新着商品" message={newArrivals.message} />
        )}
        {ranking.status === "ready" ? (
          <RankingList entries={ranking.value} />
        ) : (
          <SectionFailure label="売れ筋ランキング" message={ranking.message} />
        )}
      </>
    );
  },
);

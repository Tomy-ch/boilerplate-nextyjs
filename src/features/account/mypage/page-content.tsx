import { getMyPurchases } from "@/adapters/server/api/purchases";
import { getMyProfile, getMyPurchaseSummary } from "@/adapters/server/api/users";
import { withScreenSpan } from "@/observability/render-span";
import { MypageView } from "./view";

/**
 * 履歴の dialog へ渡す件数。
 *
 * @remarks
 * 契約の上限は 200 で、既定は 50 です。既定のままにするのは、局所スクロールで読み進められる
 * 範囲を超えて持っても、読む側の負担が増えるだけだからです。続きを読む経路は購入履歴の画面が
 * 持ちます。
 */
const HISTORY_PAGE_SIZE = 50;

/**
 * マイページの取得と組み立て。
 *
 * @remarks
 * 3 系統を並行で取ります。互いに依存しないので、順に待つと遅いものの後ろに速いものが並ぶだけです。
 *
 * 履歴を開く前に取るのは、dialog を開いた時点で待たせないためです。増分取得へ倒すには
 * same-origin の Route Handler が要り、それは購入履歴の画面が持ちます。
 * ここで先に取っておけば、その口が生えるまで待たずに済みます。
 *
 * 部分的な失敗を許しません。どれも自分自身の情報で、片方だけが出ている画面は「何かが壊れている」
 * 以上のことを伝えないためです。失敗は route の `error` 境界が受けます。
 */
export const MypagePageContent = withScreenSpan(
  "features/account/mypage/page-content",
  async () => {
    const [profile, summary, purchases] = await Promise.all([
      getMyProfile(),
      getMyPurchaseSummary(),
      getMyPurchases({ first: HISTORY_PAGE_SIZE, includeOtherUsers: false }),
    ]);

    return <MypageView profile={profile} purchases={purchases} summary={summary} />;
  },
);

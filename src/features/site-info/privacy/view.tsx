import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";
import { AlertTriangleIcon } from "@/components/icon";
import { withScreenSpan } from "@/observability/render-span";

/**
 * 入力した情報がどこへ行くかの説明。
 *
 * @remarks
 * 一般的なプライバシーポリシーの体裁は採りません。**入力した情報がどこに残るかは、この
 * boilerplate をどう起動しているかで 3 通りに変わる**ためで、そこを説明しないと、利用者は
 * 自分の情報がどこにあるのかを判断できません。
 *
 * 偽名を使うよう求める文を先頭の警告に置きます。3 通りの説明を読み終えてから書いても、
 * 既に入力した後です。
 */
export const PrivacyView = withScreenSpan("features/site-info/privacy/view", () => {
  return (
    <div className="flex max-w-3xl flex-col gap-8 text-sm leading-relaxed">
      <Alert variant="destructive">
        <AlertTriangleIcon />
        <AlertTitle>本物の個人情報を入力しないでください</AlertTitle>
        <AlertDescription>
          <p>
            公開されているサンプルサイトへ入力した情報は、サンプル用のデータベースへ保存されます。
            この保存先に対して特別なセキュリティ対策を講じる予定はありません。氏名・住所・電話番号・
            メールアドレスには、<strong>必ず偽名や実在しない値を入れてください。</strong>
          </p>
        </AlertDescription>
      </Alert>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-emphasis">入力した情報がどこに残るか</h2>
        <p>
          このサイトをどう起動しているかで、保存先が変わります。自分がどれに当たるかを確かめて
          ください。
        </p>

        <h3 className="mt-2 font-emphasis">1. 自分で clone して Go 側と繋いでいる場合</h3>
        <p>
          入力した情報は、自分の手元で動いているデータベースに保存されます。外部へは送られません。
          消したい場合は、そのデータベースごと破棄してください。
        </p>

        <h3 className="mt-2 font-emphasis">2. 自分で clone してモックのまま動かしている場合</h3>
        <p>
          入力した情報は<strong>どこにも保存されません</strong>。応答は契約から生成したモックが
          その場で組み立てており、保存する先そのものがありません。画面を再読み込みすると消えます。
        </p>

        <h3 className="mt-2 font-emphasis">3. 公開されているサンプルサイトを見ている場合</h3>
        <p>
          入力した情報は<strong>サンプル用のデータベースへ保存されます</strong>。デモの表示に
          使うための保存であり、暗号化・アクセス制限・保存期間の管理といった対策は行っていません。
          運用の都合で予告なく全件を削除することもあります。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-emphasis">追跡と第三者提供</h2>
        <p>
          アクセス解析・広告・その他の追跡は行っていません。入力された情報を第三者へ提供する
          こともありません。
        </p>
      </section>
    </div>
  );
});

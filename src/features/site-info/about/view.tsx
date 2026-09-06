import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";
import { AlertTriangleIcon } from "@/components/icon";
import { withScreenSpan } from "@/observability/render-span";
import { TERMS_PATH } from "../facade/paths/paths";
import { RepositoryCards } from "../ui/repository-cards/repository-cards";

/**
 * このサイトについての説明。
 *
 * @remarks
 * トップの断り書きは「実在の取引と取り違えられない」ことだけを担い、短く保っています。ここは
 * その続きで、**何のためのサイトか・何で出来ているか・何が動かないか**を書きます。
 *
 * 設計上の呼び名（層の分け方や責務の所在）は書きません。このサイトを触りに来た利用者にとって
 * 判断材料にならず、読みたい人はリポジトリへ行くためです。
 *
 * 免責は利用規約が持ちます。同じ文を 2 か所に置くと、片方だけ直した状態を作れます。
 */
export const AboutView = withScreenSpan("features/site-info/about/view", () => {
  return (
    <div className="flex max-w-3xl flex-col gap-8 text-sm leading-relaxed">
      <Alert variant="warning">
        <AlertTriangleIcon />
        <AlertTitle>サンプルサイトです</AlertTitle>
        <AlertDescription>
          <p>掲載している商品・企業・価格・在庫はすべて架空で、実在しません。</p>
        </AlertDescription>
      </Alert>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-emphasis">何のためのサイトか</h2>
        <p>
          作者が公開しているコードが、実際に動くとどうなるかを触って確かめるためのサイトです。 EC
          を題材にしているのは、一覧・検索・カート・フォーム・ログイン・権限といった要素が
          一通り出てくるためで、EC そのものを提供することが目的ではありません。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-emphasis">何で出来ているか</h2>
        <p>2 つのリポジトリで出来ています。どちらも公開しており、手元で動かせます。</p>
        <p>
          どちらも、このサンプルサイトとしての機能のほかに、
          <strong>boilerplate の名のとおり基盤として使うため、サンプル部分を除去する機能</strong>
          を持ちます。
        </p>
        <RepositoryCards />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-emphasis">動かないもの</h2>
        <p>
          購入と決済は成立しません。注文しても商品は届かず、請求も発生しません。メールの送信、
          問い合わせ、配送状況の追跡も動きません。表示される日時・件数・金額は、いずれも
          デモ用に用意した値です。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-emphasis">メンテナンスについて</h2>
        <p>
          インターネット上で公開している場合、
          <strong>予告なくメンテナンスを行うことがあります。</strong>
          お知らせ画面での通知は行いません。保存した内容が残り続けることも、同じ画面が明日も
          存在することも保証しません。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-emphasis">利用にあたって</h2>
        <p>
          免責を含む利用上の条件は利用規約にまとめてあります。閲覧した時点で同意したものと
          みなすため、先に読んでください。
        </p>
        <Button asChild className="self-start" variant={BUTTON_VARIANT.OUTLINE}>
          <Link href={TERMS_PATH}>利用規約を読む</Link>
        </Button>
      </section>
    </div>
  );
});

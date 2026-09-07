/** このサイトを構成しているリポジトリ 1 つ分。 */
export type Repository = {
  readonly name: string;
  readonly url: string;
  /** フッターの補足に載せる 1 文。 */
  readonly summary: string;
  /** このサイトについて のカードに載せる説明。 */
  readonly description: string;
  /** 何のために作られたか。補足の面に載せる。 */
  readonly purpose: string;
  /** 備えている機能。補足の面に載せる。 */
  readonly capabilities: readonly string[];
};

/**
 * このサイトを構成しているリポジトリ。
 *
 * @remarks
 * フッターの導線・「このサイトについて」のカード・補足の面が同じ表を読みます。別々に持つと、
 * 片方だけ名前や URL が古いまま残ります。
 */
export const REPOSITORIES = [
  {
    name: "nextjs-boilerplate",
    url: "https://github.com/Tomy-ch/nextjs-boilerplate",
    summary: "このサイトそのもの。画面と操作の実装一式です。",
    description:
      "このサイトそのものです。Next.js と React で作られていて、画面・入力フォーム・カート・認証の往復といった、利用者が触る部分の実装が入っています。この題材の EC サイトは、その実装を一通り並べて見せるために用意したものです。",
    purpose:
      "画面側のプロジェクトを始めるときの出発点です。ディレクトリの切り方・データの取り方・エラーの見せ方・テストの書き方といった決めごとを、毎回やり直さずに済む状態で配ることを目的にしています。",
    capabilities: [
      "一覧・検索・詳細・カート・フォーム・ログイン・権限による出し分けが、動く状態で入っています",
      "API の契約から型・入力検証・モックを生成するため、バックエンドが無くても画面だけで動きます",
      "サンプルの題材を除去して、基盤だけを取り出せます",
      "テスト・アクセシビリティ・見た目の差分・バンドルサイズを CI で見ます",
    ],
  },
  {
    name: "go-boilerplate",
    url: "https://github.com/Tomy-ch/go-boilerplate",
    summary: "このサイトが繋いでいるバックエンド。商品・購入・ユーザーの API です。",
    description:
      "このサイトが繋いでいるバックエンドです。Go で作られていて、商品・購入・ユーザーの API を提供します。手元で両方を動かすと、商品を探してから購入するまでの流れを通しで試せます。",
    purpose:
      "API 側のプロジェクトを始めるときの出発点です。Go / Echo / OpenAPI / PostgreSQL を Onion Architecture で組み、運用で必要になる部分をあらかじめ配線しておくことを目的にしています。",
    capabilities: [
      "OpenAPI の契約からハンドラと型を生成し、型安全な SQL でデータベースを扱います",
      "バックグラウンド処理・Transactional Outbox・冪等な要求の受け付けが入っています",
      "JWT と JWKS による認証を備え、開発用の OIDC provider を同梱しています",
      "OpenTelemetry でトレース・メトリクス・ログを出します",
      "環境設定とマイグレーションを内蔵した単一のバイナリになります",
    ],
  },
] satisfies readonly [Repository, ...Repository[]];

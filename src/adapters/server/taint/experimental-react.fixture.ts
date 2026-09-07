/**
 * Next.js 同梱の experimental React 一式の綴り。
 *
 * @remarks
 * `experimental.taint` を立てた Next.js が RSC の描画に使うのはこのビルドで、stable の `react` は
 * taint の口を持ちません。**テストだけが読みます** —— 本番は Next.js が `react` の
 * 解決先をこちらへ差し替えるので、アプリのコードは `react` を綴るだけで足ります
 * （`scripts/lib/untested-modules.ts` の `TEST_FIXTURE_MODULES`）。
 *
 * ここに置くのは綴りだけで、実体の位置を解くのは読む側です。pnpm の配置で実体の位置は変わるため
 * `next` の package から辿る必要があり、その解決には Node の組み込みが要ります。
 */
export const EXPERIMENTAL_REACT_MODULES = {
  /** react-server 条件で読む React 本体。taint の登録簿を持つ。 */
  react: "next/dist/compiled/react-experimental/react.react-server.js",
  /** 同じ条件の React DOM。直列化器が要求する。 */
  reactDom: "next/dist/compiled/react-dom-experimental/react-dom.react-server.js",
  /** RSC の直列化器。 */
  serverDom: "next/dist/compiled/react-server-dom-webpack-experimental/server.node.js",
} as const;

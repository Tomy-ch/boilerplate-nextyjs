import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

import { isServedOverTls } from "./src/config/auth/auth.schema";
import { getEnvironment, validateEnvironment } from "./src/config/environment";
import { isDevelopmentOnlyEndpointOpen, loadEnvironment } from "./src/config/load-environment";
import { buildSecurityHeaders } from "./src/config/security-headers/security-headers";

/** すべての環境で route として扱う拡張子。 */
const ROUTE_EXTENSIONS = ["tsx", "ts"];

/**
 * 開発専用の route が名乗る拡張子。
 *
 * @remarks
 * `page.dev.tsx` / `route.dev.ts` は、開発と CI の build にしか含まれません。実行時の判定
 * （`isDevelopmentAccessAllowed()`）と二重にしているのは、**残っていない**ことと**開かない**ことが
 * 別の保証だからです。build から外れていれば、設定を誤って `APP_ENV` を取り違えても、その成果物に
 * 面そのものが存在しません。
 */
const DEVELOPMENT_ROUTE_EXTENSIONS = ["dev.tsx", "dev.ts"];

/**
 * 要求本体のうち、送るファイル以外が占めるぶんの余裕。
 *
 * @remarks
 * 中継の上限が押さえるのは**ファイルの大きさ**で、要求本体はそれに multipart の境界・ヘッダ・
 * 項目のメタデータが加わったものです。同値にすると上限ちょうどのファイルがこの差だけ超えて
 * 落ちるため、封筒のぶんを足します。Next.js は目安として 10〜20 KB を挙げており、その上端から
 * 2 の冪で 1 段上を取ります。
 */
const REQUEST_ENVELOPE_BYTES = 32 * 1024;

/**
 * Next.js の build / 開発サーバー初期化時に ENV を読み込み、全量検証してから設定を返す。
 */
const nextConfig = async (phase: string): Promise<NextConfig> => {
  loadEnvironment();
  validateEnvironment();

  const environment = getEnvironment();
  const mediaOrigin = new URL(environment.MEDIA_ORIGIN);

  return {
    // 静的な殻と動的な穴に分けて配る。
    // 取得は `use cache` を付けたものだけがプリレンダーへ入り、それ以外は穴として後から届く。
    //
    // **segment config（`export const dynamic`）はこのフラグと併存しない。** 描くモードの宣言は
    // 器の形そのもの（何を `Suspense` の外に置くか）へ移り、突合は `scripts/render-mode` が
    // プリレンダーの実態と照らす。
    cacheComponents: true,
    // リクエストをまたいで残す取得の寿命。**取得の口は profile の名前だけを名乗り、秒数は
    // ここが持つ。** テンプレートから作った側は口を 1 つも触らずにこの値だけを動かせる。
    cacheLife: {
      // バックエンドが持ち、この面からは更新しないマスタ（分類・状態・都道府県）。
      //
      // **`expire` を置かない。**置かないと既定 profile の「期限で切れない」を継ぎ、書き出される
      // 値は 1 年になる —— Next が期限なしを表す値であって、1 年で切れるという意味ではない。
      masters: {
        // 5 分。30 秒を下回ると殻から外れ、5 分を超えると client が持ち歩く時間だけが伸びる。
        stale: 60 * 5,
        // 1 日。無効化を撃つ口を持たない取得なので（`product-masters.ts` のタグの項）、
        // 古さの上限を決めているのはこの値だけである。
        revalidate: 60 * 60 * 24,
      },
    },
    // 印（`"use memo"`）を付けた component だけを React Compiler へ通す。
    //
    // **どこへ付けるかはここが決めない。** ここが持つのは「印の無いものは通さない」ことだけで、
    // 対象の宣言は component の側に `"use memo"` として立つ。付けた理由はその feature の README が
    // 持つ。
    reactCompiler: { compilationMode: "annotation" },
    // 要求の内容に依らないヘッダは全経路へ静的に付ける。`src/proxy.ts` で足すと前捌きを通る
    // 経路にしか載らず、静的に配れる応答が漏れる。
    async headers() {
      return [
        {
          source: "/:path*",
          headers: buildSecurityHeaders({
            mediaOrigin: environment.MEDIA_ORIGIN,
            authIssuer: environment.AUTH_ISSUER,
            servesOverTls: isServedOverTls(environment.AUTH_REDIRECT_URI),
            development: phase === PHASE_DEVELOPMENT_SERVER,
            gtmContainerId: environment.NEXT_PUBLIC_ANALYTICS_GTM_CONTAINER_ID,
          }),
        },
      ];
    },
    // 使っているフレームワークと版を名乗らない。攻撃者が既知の脆弱性を引き当てる手間が減るだけで、
    // 名乗ることで得られるものが無い。
    poweredByHeader: false,
    // `next dev` が `AGENTS.md` を生成し直さないようにする。この repo の `AGENTS.md` は
    // `<!-- BEGIN:nextjs-agent-rules -->` の内側に自分の規約を持っており、生成が走ると
    // その中身ごと置き換わる。差分として現れるので気付けはするが、気付くたびに戻す作りにしない。
    agentRules: false,
    // `APP_ENV` が明示されていない build も開発ではない側へ倒す。判定は
    // `isDevelopmentOnlyEndpointOpen()` が持ち、実行時の判定と同じ 1 つの条件を見る。
    pageExtensions: isDevelopmentOnlyEndpointOpen()
      ? [...DEVELOPMENT_ROUTE_EXTENSIONS, ...ROUTE_EXTENSIONS]
      : ROUTE_EXTENSIONS,
    experimental: {
      // server の object と秘密値を Client Component へ渡した時点で落とす。
      //
      // **client へ配る React が experimental チャンネルへ変わる。** 呼び出しを 1 つも書かなくても
      // 全 route が gzip で数 KB 増える。それを承知で採るのは、実装が React 本体そのもので、
      // 本体側に利用を案内する資料があるためである。
      //
      // **環境で切り替えない。** dev だけ有効にすると、検証する React と配る React が違うという
      // 別の不整合を作る。
      taint: true,
      serverActions: {
        // 上限の出所は env の 1 行で、ここは封筒のぶんを足すだけにする。単位付きの文字列で
        // 書き直すと同じ閾値が 2 か所に現れ、片方だけ動かせる状態になる。
        //
        // **この上限は全 Server Action へ及ぶ。** Next.js は action ごとの上限を持たないため、
        // ファイルのために上げた値がテキストしか受け取らない口にも効く。
        bodySizeLimit: environment.NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES + REQUEST_ENVELOPE_BYTES,
      },
    },
    images: {
      // 配信元は環境ごとに変わるため、許可も検証済みの ENV から組み立てる。ここへ直接書くと
      // 環境変数と設定の 2 か所が別々に動き、片方だけ直した状態を作れる。
      //
      // ワイルドカードは使わない。許可した host は Next.js の画像最適化が任意のパスを取りに
      // 行ける相手であり、範囲を広げるとそのまま外部リクエストの踏み台になる。
      remotePatterns: [
        {
          protocol: mediaOrigin.protocol === "https:" ? "https" : "http",
          hostname: mediaOrigin.hostname,
          port: mediaOrigin.port,
          pathname: "/**",
        },
      ],
    },
  };
};

export default nextConfig;

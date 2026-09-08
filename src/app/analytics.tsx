"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { GTM_CONTAINER_ID } from "@/config/analytics/analytics.client";
import { MEASUREMENT_ID_COOKIE_NAME } from "@/model/consent";

/**
 * 前捌きが配る計測 id の形。
 *
 * @remarks
 * **渡す前に形を確かめます。** この cookie は `httpOnly` を付けられないので、書ける相手が居ます。
 * 渡した先の容器が値をどう使うかはこちらの管轄外で、URL へ載せるタグを入れることもできます。
 * 自分が出す値の形は自分で保証します。
 */
const MEASUREMENT_ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * 前捌きが配った計測 id。形が合わなければ `undefined`。
 *
 * @remarks
 * **同意した直後はまだ配られていません。** 発行するのは前捌きで、同意を書いた後の最初の要求から
 * 載ります（`docs/spec/route/layout.function.md`）。
 *
 * `document.cookie` を生で読む実装がここと `stores/consent-store`（読む相手は同意の cookie で別物）の
 * 2 か所にあるのは、`stores` が `capabilities` を引けず、共通の読み手へ寄せられないためです。
 */
function readMeasurementId(): string | undefined {
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${MEASUREMENT_ID_COOKIE_NAME}=`))
    ?.slice(MEASUREMENT_ID_COOKIE_NAME.length + 1);

  return value !== undefined && MEASUREMENT_ID_SHAPE.test(value) ? value : undefined;
}

/**
 * タグマネージャの読み込み口。
 *
 * @remarks
 * **動的に読みます。** 静的に import すると、容器 ID を空にした配備 —— Google への依存を外した、
 * テンプレートから作った側 —— の初期 JS にもライブラリのコードが載ります。**拒否した相手に
 * バイト数を運ばせない**のが同梱の条件です。
 *
 * 同意を得るまで取りに行かない、という性質も同時に付きます。
 */
const GoogleTagManager = dynamic(() =>
  import("@next/third-parties/google").then((module) => module.GoogleTagManager),
);

/**
 * この読み込みのあいだに、すでに渡した計測 id。
 *
 * @remarks
 * 遷移のたびに {@link MeasurementId} を作り直すため、部品の中に控えると毎回消えます。同じ id を
 * 何度も渡すと、GTM 側では別々の出来事として並びます。
 */
let deliveredId: string | undefined;

/**
 * 配られている計測 id を GTM へ渡す。描くものは持たない。
 *
 * @remarks
 * **遷移のたびに作り直される前提です**（呼び出し元が `key` に経路を渡す）。mount の 1 回だけでは
 * 届きません —— 同意を押した時点では前捌きがまだ id を配っておらず、器は遷移で作り直されないため、
 * その後に配られた id を拾う機会がここにしか無いからです。
 */
function MeasurementId(): null {
  useEffect(() => {
    const measurementId = readMeasurementId();

    if (measurementId === undefined || measurementId === deliveredId) {
      return;
    }

    deliveredId = measurementId;

    // 読み込み口と同じ module からの export なので、ここも動的に読む。
    void import("@next/third-parties/google").then(({ sendGTMEvent }) => {
      sendGTMEvent({ [MEASUREMENT_ID_COOKIE_NAME]: measurementId });
    });
  }, []);

  return null;
}

/**
 * 同意ゲートの裏で読み込むタグマネージャ。
 *
 * @remarks
 * **`Consent` の children として置きます。** 同意が得られていない間はこの要素そのものが
 * 描かれないので、DOM にも script が現れません。
 *
 * **容器 ID が空なら何も描きません。** 空の意味は `config/analytics/analytics.schema.ts` が持ちます。
 * 配信ヘッダが連動することは `config/security-headers` の契約です。
 *
 * **`<noscript>` の iframe は置きません。** JS が無効な訪問者には同意を与える手段が無く、
 * 置けばその相手にだけ無条件で発火するためです。
 *
 * **この先は中継を通りません。** Google と直接通信する仕組みで、`/api/telemetry` の伏せ字の外に
 * あります。
 *
 * **読み込みの strategy は選べません。** `GoogleTagManager` は prop を公開しておらず、`next/script`
 * の既定（`afterInteractive`）が効きます。`docs/rules.md`「セキュリティ」の「第三者 script は同意ゲートの
 * 裏に置く」が求める strategy の「明示」を宣言では満たせないため、いま効いている値をテストで固定し、ライブラリが既定を変えた時点で落ちるようにしています。
 *
 * **読み込んだ容器は unmount では降りません。** `afterInteractive` は effect で `document.body` へ
 * script を足し、unmount で外しません。React も `async` の付いた `<script src>` を資源として扱い、
 * 木から消えても `<head>` から外しません。同意の取り消しが効くのは次の読み込みからです
 * （`docs/spec/route/layout.function.md`「同意が無いものは読み込まない」）。
 *
 * 計測 id はこの経路以外へ渡しません。運用テレメトリ（`telemetry.tsx`）とは主体を分けます。
 */
export function Analytics() {
  const pathname = usePathname();

  if (GTM_CONTAINER_ID === "") {
    return null;
  }

  return (
    <>
      <GoogleTagManager gtmId={GTM_CONTAINER_ID} />
      <MeasurementId key={pathname} />
    </>
  );
}

import Link from "next/link";

import { Card } from "@/components/design-system/display/card/card";
import { ChevronRightIcon } from "@/components/icon";
import { withPartSpan } from "@/observability/render-span";
import type { SummaryCard } from "../../summary-cards";

/** `StatCards` の props。 */
export type StatCardsProps = {
  /** 並べる数値カード。 */
  cards: readonly SummaryCard[];
  /** 一覧に名前を与える見出し。読み上げにだけ出す。 */
  label: string;
};

const FOCUS_RING =
  "rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

/**
 * 集計を数値で並べる枠。
 *
 * @remarks
 * `dl` で組みます。並んでいるのは「名前と、その名前が指す値」の組であり、見出しと本文でも
 * 表でもありません。読み上げでも組として伝わります。
 *
 * **注記を値と同じ枠に置きます。** 3 つの指標は母集団が違うため（`model/dashboard`）、注記が
 * カードの外にあると、どの数に掛かる断りなのかが位置から読めません。
 *
 * **中身を並べた面があるカードだけが押せます。** 押せるかどうかは行き先の有無で決まり、その
 * 判断は `../../summary-cards.ts` が持ちます。押せるカードは面ごと押せますが、link で包んでは
 * いません —— 包むと注記まで遷移先の名前として読み上げられます。代わりに見出しの link を
 * 疑似要素で面いっぱいに広げ、支援技術には見出しだけが遷移先として見えるようにしています。
 *
 * **押せることを、hover を待たずに示します。** 見出しの色を落とさず矢印を添えるのがその印で、
 * 枠の色が変わるだけだと、指で触るまで押せる面かどうかが判りません。矢印は装飾なので読み上げ
 * からは外し、行き先の説明は link の名前（`linkLabel`）が持ちます。
 *
 * **狭い段でも 2 列を保ちます。** 4 枚を縦に積むと、この下に置く内訳が最初の画面から押し出され、
 * 数だけを見て帰る利用者にも巻き取りを強います。値は `tabular-nums` で桁を揃え、列が細くても
 * 隣と比べられるようにしています。
 *
 * **値を大きくするのは 4 列に割ってなお幅が余る段からです。** 4 列へ切り替わる段でそのまま
 * 大きくすると、通貨記号と桁区切りを伴う金額が 1 列に収まらず、常に末尾が落ちます。
 *
 * **列に収まらない値は末尾を落とします。** 桁数に上限を置けるのは画面ではなく契約の側で、
 * ここへ来る時点の値の長さは決まっていません。落とすのを末尾にするのは、上位の桁が残れば
 * 大きさが読めるためです。読み上げには全桁が渡ります —— 落ちるのは描画だけです。
 *
 * @see Storybook `Page/Admin/Dashboard`
 */
export const StatCards = withPartSpan(
  "features/admin/ui/stat-cards/stat-cards",
  ({ cards, label }: StatCardsProps) => {
    return (
      <section aria-label={label}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {cards.map((card) => (
            <Card
              // `min-w-0` が要る。grid の子は既定で中身より狭くならないため、これが無いと
              // 長い値がカードの枠ごと押し広げ、隣へはみ出す。
              className={`min-w-0 gap-1 px-4 py-4 lg:px-5 lg:py-5 ${
                card.href === undefined ? "" : "relative cursor-pointer hover:border-active"
              }`}
              key={card.id}
            >
              <dt className="text-sm text-muted-foreground">
                {card.href === undefined ? (
                  card.label
                ) : (
                  <Link
                    aria-label={card.linkLabel}
                    className={`${FOCUS_RING} inline-flex items-center gap-0.5 text-foreground underline-offset-4 after:absolute after:inset-0 hover:underline`}
                    href={card.href}
                  >
                    {card.label}
                    <ChevronRightIcon aria-hidden="true" className="size-3.5" />
                  </Link>
                )}
              </dt>
              <dd>
                <p className="truncate text-2xl font-emphasis tabular-nums xl:text-3xl">
                  {card.value}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{card.note}</p>
              </dd>
            </Card>
          ))}
        </dl>
      </section>
    );
  },
);

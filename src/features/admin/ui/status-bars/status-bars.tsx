import type { CSSProperties } from "react";

import type { PurchaseStatusCount } from "@/model/dashboard/dashboard";
import { formatCount } from "../../count";
import { axisPercent, type BarAxis, barAxis } from "./axis";

/** `StatusBars` の props。 */
export type StatusBarsProps = {
  /** 契約が返した順序のままのステータス別件数。 */
  counts: readonly PurchaseStatusCount[];
};

/** 目盛りの数字を、指す位置へ置く。両端だけは軸の内側へ寄せて、枠から出ないようにする。 */
function tickStyle(tick: number, index: number, axis: BarAxis): CSSProperties {
  const left = axisPercent(tick, axis);

  if (index === 0) {
    return { left };
  }

  return {
    left,
    transform: index === axis.ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
  };
}

/**
 * ステータス別件数を横棒で並べる。
 *
 * @remarks
 * **これは補助であって、唯一の伝達手段ではありません。** 同じ内容は隣の表が数で持ちます
 * （`../status-breakdown/`）。形と色でしか読めない情報をここに置きません。
 *
 * **作図の一式を持ち込まず、要素と CSS だけで描きます。** 描くのは 0 から始まる 1 系列の帯と
 * その軸だけで、作図の一式が備える座標系・凡例・tooltip・アニメーションのどれも使いません。
 * 持ち込むと、この画面を開いた人がその読み込みと評価を払います。
 *
 * **tooltip も凡例も置きません。** tooltip は pointer を合わせている間だけ現れるため touch と
 * keyboard から到達できず、凡例は系列が 1 本しかない場では色の対応を説明する相手がいません。
 *
 * **横棒にしています。** 並ぶのはステータス名という長さのまちまちな文字列で、縦棒にすると
 * 軸の目盛りが回転するか省略されます。横棒なら名前は行として読めます。
 *
 * **帯の太さに上限を置きます。** 太さは行数で決まるため、上限が無いとステータスが 1 つだけの
 * 期間で 1 本が枠を埋めます。
 *
 * **帯の色は紙にも残します**（`print-color-keep`）。長さが情報で、色はその長さを見せる手段なので、
 * 省かれると行名と目盛りだけの空白になります。
 *
 * 取得も並べ替えも持たず、渡された配列をそのまま描きます。
 *
 * @see Storybook `Features/Admin/StatusBars`
 */
export function StatusBars({ counts }: StatusBarsProps) {
  const axis = barAxis(counts.map((entry) => entry.count));

  return (
    <div className="flex h-56 w-full pl-2 text-xs text-muted-foreground">
      <div className="flex w-20 shrink-0 flex-col pr-2 pb-6">
        {counts.map((entry) => (
          <div className="flex flex-1 items-center justify-end" key={entry.statusId}>
            <span className="min-w-0 truncate">{entry.statusName}</span>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          {counts.map((entry) => (
            <div className="flex flex-1 items-center py-1" key={entry.statusId}>
              <div
                className="print-color-keep h-full max-h-7 rounded-md bg-primary"
                style={{ width: axisPercent(entry.count, axis) }}
              />
            </div>
          ))}
        </div>
        <div className="relative h-6 pt-1 tabular-nums">
          {axis.ticks.map((tick, index) => (
            <span className="absolute" key={tick} style={tickStyle(tick, index, axis)}>
              {formatCount(tick)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

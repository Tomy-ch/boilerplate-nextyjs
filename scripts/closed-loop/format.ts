// 数を人が読む形にする判定。端末の報告([report.ts](report.ts))と issue の本文
// ([issue.ts](issue.ts))が同じ数を同じ言い方で出すために、ここに 1 つだけ置く。

/**
 * 秒を、桁を見て読みやすい単位へ落とす。
 *
 * @remarks
 * **負の値も秒のまま出します。**打刻が逆順の窓では区間が負になり、そこを 0 へ丸めると
 * **順序の壊れた窓が正常な窓と同じ見た目になります**。異常として挙げるのは
 * [phases.ts](phases.ts) の仕事で、ここはその値を隠さないことだけを持ちます。
 */
export function humanize(seconds: number): string {
  if (seconds < 90) {
    return `${seconds} 秒`;
  }

  if (seconds < 5400) {
    return `${Math.round(seconds / 60)} 分`;
  }

  return `${(seconds / 3600).toFixed(1)} 時間`;
}

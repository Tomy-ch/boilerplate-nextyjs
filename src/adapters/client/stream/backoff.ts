/** 張り直しまでの待ち時間の下限。連続した失敗でここから倍に伸びる。 */
const BASE_DELAY_MS = 1_000;

/** 張り直しまでの待ち時間の上限。 */
const MAX_DELAY_MS = 30_000;

/**
 * 次に張り直すまでの待ち時間を決める。
 *
 * @remarks
 * **必ず散らします。** 一斉に切れた接続が同じ時刻に戻ると、その瞬間だけ backend の受け口が
 * 接続の山を受けます。散らす幅を半分に取るのは、待ち時間の下限を保ったまま山を崩すためです。
 *
 * **サーバの目安があればそちらを使います。** 送り手は自分の込み具合を知っており、こちらの
 * 数え方より確かです。目安にも散らしを掛けるのは、目安が同じ値で全 client へ配られるためです。
 *
 * @param attempt - 続けて失敗した回数。0 が最初の張り直し
 * @param random - 散らしに使う乱数。`Math.random` と同じ範囲を返すこと
 * @param hintMs - サーバが示した目安。無ければ回数から決める
 */
export function nextDelayMs(attempt: number, random: () => number, hintMs?: number): number {
  const ceiling = hintMs ?? Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);

  return Math.round(ceiling / 2 + ceiling * random() * 0.5);
}

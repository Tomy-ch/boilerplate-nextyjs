import "server-only";

import { experimental_taintObjectReference, experimental_taintUniqueValue } from "react";

/**
 * その object を Client Component へ渡せなくする。
 *
 * @remarks
 * 渡した時点で RSC の直列化が投げ、`message` がその理由として出ます。**参照でしか追いません** ——
 * コピー（`{ ...object }`）や項目を抜き出した値には及ばないので、主防御は取得範囲と Client DTO の
 * 最小化で、これは抜けた誤送信を実行時に捕まえる補助です。
 *
 * `react` の experimental API を直接呼ばず、ここを通します。テストは**このモジュール境界を差し替え**、
 * 本物の API が効くことはこのモジュール自身のテストが RSC の直列化器で確かめます。
 *
 * @param message - 渡してはいけない理由。落ちたときにそのまま出る
 * @param object - 汚す object
 */
export function taintObjectReference(message: string, object: object): void {
  experimental_taintObjectReference(message, object);
}

/**
 * その値を Client Component へ渡せなくする。
 *
 * @remarks
 * 文字列のような値は参照で追えないため、値そのものを登録します。派生値（`` `Bearer ${value}` ``）
 * には及びません。`lifetime` が GC されるまで登録が残るので、プロセスの間ずっと守りたい値は
 * プロセス内の singleton（`getAuthConfig()` など）を渡します。
 *
 * @param message - 渡してはいけない理由。落ちたときにそのまま出る
 * @param lifetime - 登録の寿命を握る object
 * @param value - 汚す値
 */
export function taintUniqueValue(message: string, lifetime: object, value: string): void {
  experimental_taintUniqueValue(message, lifetime, value);
}

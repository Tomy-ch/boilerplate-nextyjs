// sample:replace-begin
import * as generated from "./api/endpoints.msw";
import { REFERENCE_PATCHES } from "./references";
import { stableHandlers } from "./stable-responses";

/**
 * 契約から生成した MSW ハンドラ一式。
 *
 * @remarks
 * **ここが持つのは契約ごとの配線だけです。** どの生成物を通すかと、口をまたいで指し合う項目の
 * 表がそれにあたります。組み立ての規則も並び順も
 * [stable-responses](stable-responses.ts) が持つので、契約を差し替えてもこの 1 行が動くだけです。
 *
 * 手書きしない理由は [README](README.md) が持ちます。
 */
export const handlers = stableHandlers(generated, REFERENCE_PATCHES);
// sample:replace-with
// = /**
// =  * 契約から生成した MSW ハンドラ一式。
// =  *
// =  * @remarks
// =  * 空なのは契約をまだ置いていないためです。`make api-gen` が生成物を出したら、それを
// =  * [stable-responses](stable-responses.ts) へ渡す 1 行をここへ書きます（[README](README.md)）。
// =  */
// = export const handlers: never[] = [];
// sample:replace-end

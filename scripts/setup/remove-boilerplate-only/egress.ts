/**
 * 剥がしで参照が消える egress 宣言。判定は [lib](../lib/egress-declaration.ts) が持つ。
 *
 * @remarks
 * `.github/egress.yaml` は「どの workflow も対応しないキー」で
 * [`make egress-check`](../../../.makefiles/tools/egress.mk) が落ちます。workflow をまるごと
 * 消す剥がしは、その workflow のためだけに置いた宛先を必ず孤児にします。
 *
 * [pins](pins.ts) と同じ形で、同じ理由です —— 宣言をファイルの中のマーカーで持てません。
 */

/**
 * 剥がしと同時に孤児になる workflow の名前。
 *
 * @remarks
 * `.github/workflows/<名前>.yaml` の `<名前>` です。ここが増えるのは、剥がしが workflow を
 * 1 本消すときだけなので、[manifest](manifest.ts) の削除対象と対で動きます。
 */
export const ORPHANED_WORKFLOWS: readonly string[] = ["strip-verify"];

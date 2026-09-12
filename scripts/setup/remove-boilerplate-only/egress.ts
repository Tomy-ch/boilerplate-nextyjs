/**
 * 剥がしで参照が消える egress 宣言の除去。
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
export const ORPHANED_WORKFLOWS: readonly string[] = [
  "codeql",
  "dependency-review",
  "sonarcloud",
  "strip-verify",
];

/**
 * 孤児になる宣言の塊を落とす。
 *
 * @param text - `.github/egress.yaml` の中身。
 * @param names - 落とす workflow の名前。
 * @returns 書き戻す中身。落とす塊が無ければ元のまま。
 *
 * @remarks
 * 1 つのキーが持つのは「キーの行」と、それに続く**より深く字下げされた行**です。次に同じか
 * 浅い字下げの行が来た時点で、その塊は終わっています。空行は塊の切れ目として扱いません ——
 * 続きの前に空行を置いた宣言でも、同じ塊として落とす必要があります。
 */
export function dropOrphanedEndpoints(text: string, names: readonly string[]): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let dropping: number | null = null;

  for (const line of lines) {
    const indent = line.length - line.trimStart().length;

    if (dropping !== null) {
      if (line.trim() === "" || indent > dropping) continue;
      dropping = null;
    }

    const name = /^([A-Za-z0-9_-]+):/.exec(line.trimStart())?.[1];

    if (name !== undefined && names.includes(name)) {
      dropping = indent;
      continue;
    }

    kept.push(line);
  }

  return kept.length === lines.length ? text : kept.join("\n");
}

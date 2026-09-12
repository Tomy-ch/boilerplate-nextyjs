// `.github/egress.yaml` から、参照が消えた workflow の宛先宣言を落とす判定。
//
// 剥がし（`remove-boilerplate-only`）と、資格情報を要するスキャナの撤去
// （`remove-licensed-scanners`）の双方が使う。どちらも「workflow を 1 本消すと、その workflow
// のためだけに置いた宛先が孤児になる」という同じ形を持ち、`make egress-check` は
// 「どの workflow も対応しないキー」で落ちる。

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

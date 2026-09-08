// 打刻の置き場から窓を組み立てる判定。読み取りそのものは入口が持ち、ここは受け取った
// 読み手だけを使う。報告([index.ts](index.ts))と送出([send/index.ts](send/index.ts))の
// 両方が同じ窓を見るために、この組み立てを 1 箇所に置く。

import { MARK_ORDER, type WindowMarks } from "./phases.js";

/** 打刻の読み手。実物の fs か、試験の作り物か。 */
export type MarksReader = {
  /** その作業ツリーに在る窓の id。置き場が無ければ空 */
  listWindowIds(root: string): readonly string[];
  /** 打刻ファイルの中身。無ければ null */
  readMark(root: string, id: string, name: string): string | null;
};

/**
 * `git worktree list --porcelain` の出力から作業ツリーのパスを取り出す。
 *
 * @remarks
 * **形が崩れた出力を 0 件へ縮退させません。**`worktree ` で始まる行だけを読み、他の行は
 * 無視します。git の出力は版によって行が増えるので、知らない行で落ちると
 * **git が新しいだけで窓を 1 つも数えなくなります**。
 */
export function toWorktreePaths(stdout: string): readonly string[] {
  const prefix = "worktree ";

  return stdout
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim())
    .filter((path) => path !== "");
}

/** 打刻ファイルの中身を epoch の並びにする。読めない行は落とす。 */
function toEpochs(raw: string): readonly number[] {
  return raw
    .split("\n")
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((value) => Number.isFinite(value));
}

/**
 * すべての作業ツリーの窓を、古い順に並べる。
 *
 * @remarks
 * 窓の id は `w<epoch>-<接尾辞>` なので、名前で並べると開いた順になります。作業ツリーを
 * 跨いでも同じ規則で並ぶので、どの窓がどの作業ツリーのものかは並びに影響しません。
 *
 * 読むのは `MARK_ORDER` に在る名前だけです。知らない名前を拾うと、打ち間違いが打刻として
 * 集計に混ざります —— 名前の集合が閉じているのは刻む側と同じ理由です。
 */
export function collectWindows(
  roots: readonly string[],
  reader: MarksReader,
): readonly WindowMarks[] {
  return roots
    .flatMap((root) =>
      reader.listWindowIds(root).map((id) => {
        const marks: Record<string, readonly number[]> = {};

        for (const name of MARK_ORDER) {
          const raw = reader.readMark(root, id, name);

          if (raw === null) {
            continue;
          }

          const epochs = toEpochs(raw);

          if (epochs.length > 0) {
            marks[name] = epochs;
          }
        }

        return { id, marks };
      }),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

// PR コメントを投稿するローカル action の同定。
//
// 検査したいのは「本文ファイルを作るジョブに secret が届いていないか」なので、
// `upsert-pr-comment` を直接呼ぶジョブだけでなく、それを内側で呼ぶローカル action を
// 経由するジョブも対象になる。ラッパを 1 枚挟むだけで検査から消えるのを避けるため、
// ローカル action 同士の参照を辿って到達可能な集合を求める。
import path from "node:path";
import { COMPOSITE_ACTION_DIR, collectActionDefinitions } from "../lib/composite-action-files.js";
import { collectUses } from "./uses.js";

export const UPSERT_ACTION_DIR = `${COMPOSITE_ACTION_DIR}/upsert-pr-comment`;

export type CommentActions = {
  // upsert-pr-comment へ（他のローカル action を経由してでも）到達するローカル action の
  // ディレクトリ。リポジトリルートからの相対パス。
  dirs: Set<string>;
  // upsert-pr-comment の定義ファイルが実在するか。action ごと削除した場合と、
  // 参照の同定が壊れて 0 件になった場合を区別するために要る。
  defined: boolean;
};

// ローカル action の `uses:` をディレクトリの相対パスへ正規化する。リモート action
// (`owner/repo@ref`) と docker action (`docker://...`) はローカル参照ではないため対象外。
export function localActionDir(uses: string): string | null {
  const value = uses.trim();
  if (!value.startsWith("./")) return null;
  return path.posix.normalize(value.replace(/\/+$/, ""));
}

export function collectCommentActions(
  root: string,
  readFile: (absolute: string) => string,
): CommentActions {
  const definitions: string[] = [];
  collectActionDefinitions(path.join(root, COMPOSITE_ACTION_DIR), definitions);

  // 同一ディレクトリに action.yml と action.yaml が並ぶ場合、`uses:` はどちらも同じ
  // action を指すため、参照先はディレクトリ単位でまとめる。
  const references = new Map<string, Set<string>>();
  for (const absolute of definitions) {
    const dir = toPosix(path.relative(root, path.dirname(absolute)));
    const file = toPosix(path.relative(root, absolute));
    const targets = references.get(dir) ?? new Set<string>();
    for (const uses of collectUses(file, readFile(absolute))) {
      const target = localActionDir(uses);
      if (target) targets.add(target);
    }
    references.set(dir, targets);
  }

  const dirs = new Set<string>([UPSERT_ACTION_DIR]);
  // 参照は循環しうる（GitHub 側は実行時エラーになるが定義としては書ける）ため、集合が
  // 増えなくなるまで回す固定点で求める。
  for (let grew = true; grew; ) {
    grew = false;
    for (const [dir, targets] of references) {
      if (dirs.has(dir)) continue;
      for (const target of targets) {
        if (!dirs.has(target)) continue;
        dirs.add(dir);
        grew = true;
        break;
      }
    }
  }

  return { dirs, defined: references.has(UPSERT_ACTION_DIR) };
}

// `uses:` の値は POSIX 区切りで書かれるため、比較対象のパスも区切りを揃える。
function toPosix(relative: string): string {
  return relative.split(path.sep).join("/");
}

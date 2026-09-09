// boilerplate 限定の散文を剥がす入口。マーカーの除去そのものは `../lib/markers.js` が持ち、
// ここはファイル入出力・自消滅・終了コードだけを担う。
//
// サンプル破棄と別の道具にしてあるのは、消える契機が違うためである。サンプルは題材を使うかで
// 選べるが、boilerplate 限定の散文はテンプレートから作った時点で前提が失効するので選択の余地が無い。

import path from "node:path";

import { listFilesRecursive, removeTarget, toRelativePath, updateFile } from "../lib/file-utils.js";
import { stripMarkers } from "../lib/markers.js";
import { exitWithUsage, parseCommonFlags, ROOT_DIR } from "../lib/runtime.js";
import { dropOrphanedEndpoints, ORPHANED_WORKFLOWS } from "./egress.js";
import {
  ACTIONS_PIN_LOCK_FILE,
  BINARY_EXTENSIONS,
  BOILERPLATE_ONLY_MARKER,
  EGRESS_DECLARATION_FILE,
  EXCLUDED_DIRECTORIES,
  EXCLUDED_PATH_PREFIXES,
  SELF_DESTRUCT_PATHS,
} from "./manifest.js";
import { dropOrphanedPins, ORPHANED_ACTIONS } from "./pins.js";
import { isStripTarget } from "./strip-target.js";

function printUsage(): void {
  console.log(
    [
      "使い方: pnpm exec tsx scripts/setup/remove-boilerplate-only [--dry-run]",
      "",
      "  boilerplate 限定の散文を剥がす。対象はマーカーで囲まれた区間と、行末にマーカーを持つ行。",
      "  --dry-run  実際には書き換えず、対象だけを表示する",
      "",
      "  剥がし終えると、この道具自身が消える。テンプレートから作った側では二度と走らない。",
    ].join("\n"),
  );
}

function run(dryRun: boolean): void {
  const scanned = listFilesRecursive(ROOT_DIR, { excludedDirectories: EXCLUDED_DIRECTORIES })
    .map((filePath) => toRelativePath(filePath).split(path.sep).join("/"))
    .filter((relativePath) =>
      isStripTarget(relativePath, BINARY_EXTENSIONS, EXCLUDED_PATH_PREFIXES),
    );

  const stripped: string[] = [];

  for (const relativePath of scanned) {
    let removed = 0;

    const updated = updateFile(
      relativePath,
      (content) => {
        const result = stripMarkers(content, BOILERPLATE_ONLY_MARKER);
        removed = result.removed;
        return result.content;
      },
      dryRun,
    );

    if (updated !== null) {
      stripped.push(`${relativePath} (${removed} 行)`);
    }
  }

  // 消える workflow だけが使っていた pin は、消した時点で孤児になる。孤児のエントリは
  // `make actions-pin-check` が落とすので、剥がした人の手元で初めて赤くなる。ここで一緒に落とす。
  const prunedPins = updateFile(
    ACTIONS_PIN_LOCK_FILE,
    (content) => dropOrphanedPins(content, ORPHANED_ACTIONS),
    dryRun,
  );

  // 同じ形が egress の宣言にもある。消えた workflow のための宛先は、そのまま残すと
  // `make egress-check` が孤児として落とす。
  const prunedEndpoints = updateFile(
    EGRESS_DECLARATION_FILE,
    (content) => dropOrphanedEndpoints(content, ORPHANED_WORKFLOWS),
    dryRun,
  );

  const deleted: string[] = [];

  // 自消滅は最後に行う。先に消すと、剥がしの途中で落ちたときに道具だけが失われる。
  for (const relativePath of SELF_DESTRUCT_PATHS) {
    const removed = removeTarget(relativePath, dryRun);

    if (removed !== null) {
      deleted.push(removed);
    }
  }

  console.log(
    `${dryRun ? "ドライラン" : "剥がし完了"}: マーカー ${stripped.length} / 自消滅 ${deleted.length}`,
  );

  if (prunedPins !== null) {
    console.log(`- pin 除去 ${ACTIONS_PIN_LOCK_FILE}`);
  }

  if (prunedEndpoints !== null) {
    console.log(`- 宛先の宣言を除去 ${EGRESS_DECLARATION_FILE}`);
  }

  for (const entry of stripped) {
    console.log(`- マーカー除去 ${entry}`);
  }

  for (const entry of deleted) {
    console.log(`- 削除 ${entry}`);
  }
}

/* istanbul ignore next -- CLI entry。起動経路は make setup-remove-boilerplate-only が実地で通す。 */
function main(): void {
  const options = parseCommonFlags(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  run(options.dryRun);
}

try {
  main();
} catch (error) {
  exitWithUsage(error instanceof Error ? error : new Error(String(error)), printUsage);
}

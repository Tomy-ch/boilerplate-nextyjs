#!/usr/bin/env node

// Mermaid のコードフェンス（```mermaid）を実際の mermaid パーサで構文検証する lint。
// markdownlint-cli2 は Markdown の体裁しか見ず mermaid 図の文法は素通りするため、その穴を塞ぐ。
//
// mermaid.parse は DOMPurify サニタイズで DOM を要求するため、mermaid のロードには DOM 環境が要る。
// 1 つでも壊れた図があれば非 0 で終了する。
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { collectMarkdownFiles } from "../lib/markdown-files.js";
import { errorMessage, extractMermaidBlocks, isDependencyMissing } from "./mermaid-blocks.js";

// このスクリプトが使う mermaid の最小面。mermaid の公開型は DOM 前提で重く、
// ここで必要なのは initialize / parse の 2 つだけなので構造的に絞る。
type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  parse: (text: string) => Promise<unknown>;
};

type Failure = {
  file: string;
  startLine: number;
  index: number;
  message: string;
};

// 依存ロード（環境セットアップ）。ここで失敗した場合は mermaid 図の文法問題ではなく
// 「環境未整備」なので、生のスタックトレースではなく原因と対処を明示して exit 2
// （lint 失敗の exit 1 と区別）で落とす。
async function loadMermaid(): Promise<MermaidApi> {
  try {
    // import 順の都合で mermaid より先に DOM を globalThis へ載せる必要があるため require で先行ロードする。
    const require = createRequire(import.meta.url);
    const { parseHTML } = require("linkedom");
    const { window, document } = parseHTML(
      "<!doctype html><html><head></head><body></body></html>",
    );
    // globalThis の window / document 等は DOM lib で読み取り専用のため、
    // 代入するには構造を持たない袋として扱う必要がある。
    const global = globalThis as unknown as Record<string, unknown>;
    global["window"] = window;
    global["document"] = document;
    Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
    global["location"] = window.location;
    global["requestAnimationFrame"] = (fn: () => void) => setTimeout(fn, 0);
    global["MutationObserver"] = window.MutationObserver;

    const mermaidModule = await import("mermaid");
    const mermaid = (mermaidModule.default ?? mermaidModule) as unknown as MermaidApi;
    // logLevel:5(fatal) でパース失敗時の冗長な内部ログを抑止し、整形済み出力に一本化する。
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose", logLevel: 5 });

    return mermaid;
  } catch (error) {
    console.error("✘ mermaid-lint: セットアップエラー（mermaid 図の文法問題ではありません）");

    if (isDependencyMissing(error)) {
      console.error("    原因: mermaid / linkedom を解決できません（依存が未インストール）。");
      console.error("    対処: `pnpm install` で依存を導入してから再実行してください。");
    } else {
      console.error("    原因: 依存ロード中に想定外のエラーが発生しました。");
    }

    console.error(`    詳細: ${errorMessage(error)}`);
    process.exit(2);
  }
}

async function main(): Promise<void> {
  const mermaid = await loadMermaid();
  const root = process.cwd();
  const files = collectMarkdownFiles(root);

  let blockCount = 0;
  let filesWithBlocks = 0;
  const failures: Failure[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    let content: string;

    try {
      content = fs.readFileSync(path.join(root, file), "utf8");
    } catch {
      // 読めないファイル（壊れた symlink や権限エラー）は対象外として飛ばす。
      // markdownlint も壊れた symlink を黙って飛ばすため挙動を揃える。
      skipped.push(file);
      continue;
    }

    const blocks = extractMermaidBlocks(content);

    if (blocks.length > 0) {
      filesWithBlocks++;
    }

    for (const [index, block] of blocks.entries()) {
      blockCount++;

      try {
        // mermaid はグローバルな単一インスタンス + 共有 DOM を使うため、parse は並列化せず
        // 逐次実行する（Promise.all で並列化すると共有状態が競合し得る）。
        // biome-ignore lint/performance/noAwaitInLoops: mermaid の共有状態のため逐次 parse が必須
        await mermaid.parse(block.code);
      } catch (error) {
        failures.push({
          file,
          startLine: block.startLine,
          index: index + 1,
          message: errorMessage(error),
        });
      }
    }
  }

  if (failures.length > 0) {
    console.error(`✘ mermaid-lint: ${failures.length} 件の壊れた mermaid ブロック\n`);

    for (const failure of failures) {
      console.error(`  ${failure.file}:${failure.startLine}  (block #${failure.index})`);

      for (const line of failure.message.split("\n")) {
        console.error(`    ${line}`);
      }

      console.error("");
    }

    console.error(
      `検証 ${blockCount} ブロック / ${filesWithBlocks} ファイル中 ${failures.length} 件 NG`,
    );
    process.exit(1);
  }

  const suffix = skipped.length > 0 ? `（読めず skip: ${skipped.length} 件）` : "";

  console.log(
    `✓ mermaid-lint: ${blockCount} ブロック / ${filesWithBlocks} ファイル すべて OK${suffix}`,
  );
}

main().catch((error: unknown) => {
  console.error(`✘ mermaid-lint: 想定外のエラー\n    ${errorMessage(error)}`);
  process.exit(2);
});

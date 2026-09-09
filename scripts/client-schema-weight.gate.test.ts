import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";

import {
  findHeavyClientImports,
  formatHeavyClientImports,
  isClientEntry,
  runtimeSpecifiers,
  type SourceModule,
} from "./lib/client-schema-weight";

/**
 * client bundle へ重い検証の入口が入り込んでいないかを見るゲート。
 *
 * @remarks
 * 判定の中身は `lib/client-schema-weight.ts` が持ち、ここはツリーの走査だけを担う
 * （`doc-links.gate.test.ts` と同形）。
 *
 * **型検査も lint も、import の先にある重さを見ない。** 予算（`bundle-budget`）は総量で捕まえるが、
 * **なぜ増えたかは答えない**ので、原因の側にゲートを置く。何を引くと何が配られるかは
 * `openapi/extract-limits.ts` が持つ。
 */

const REPOSITORY_ROOT = resolvePath(import.meta.dirname, "..");
const SOURCE_ROOT = join(REPOSITORY_ROOT, "src");
const TIMEOUT_MS = 60_000;

/** 走査から外す。テストと story は bundle に載らない。 */
const EXCLUDED = /\.(test|stories)\.tsx?$/;

function collect(directory: string, into: SourceModule[]): SourceModule[] {
  // 種別は dirent から読む。`statSync` で確かめてから読み直すと、その間に対象が
  // 入れ替わりうるうえ、走査 1 件につき system call が 1 つ増える。
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      collect(path, into);
      continue;
    }

    if (/\.tsx?$/.test(path) && !EXCLUDED.test(path)) {
      into.push({ path: relative(REPOSITORY_ROOT, path), content: readFileSync(path, "utf8") });
    }
  }

  return into;
}

/** import 先をリポジトリルート相対のパスへ解決する。外部パッケージは辿らない。 */
function resolveModule(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(SOURCE_ROOT, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolvePath(dirname(join(REPOSITORY_ROOT, from)), specifier)
      : null;

  if (base === null) {
    return null;
  }

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return relative(REPOSITORY_ROOT, candidate);
    }
  }

  return null;
}

describe("client bundle の重さ", () => {
  // ----- 正常系 -----
  it(
    "client から到達する module は、重い検証の入口を引かない",
    () => {
      const found = findHeavyClientImports(collect(SOURCE_ROOT, []), resolveModule);

      expect(formatHeavyClientImports(found)).toBe("");
    },
    TIMEOUT_MS,
  );

  // 上の 1 件は「見つからなかった」ことしか言わない。走査が木に届かなくなっても、解決が
  // 黙って null を返すようになっても、同じ緑になる。射程そのものをここで押さえる。
  it(
    "検査の射程が、木と解決の双方に届いている",
    () => {
      const modules = collect(SOURCE_ROOT, []);
      const resolved = { alias: 0, relative: 0 };

      for (const module of modules) {
        for (const specifier of runtimeSpecifiers(module.content)) {
          if (resolveModule(module.path, specifier) === null) {
            continue;
          }

          if (specifier.startsWith("@/")) {
            resolved.alias += 1;
          } else if (specifier.startsWith(".")) {
            resolved.relative += 1;
          }
        }
      }

      expect(modules.filter((module) => isClientEntry(module.content)).length).toBeGreaterThan(0);
      // 別名と相対の双方。どちらかが解けなくなると、上のゲートは推移的な違反を見逃す。宛先を
      // 名指しせず走査した木から数えるのは、名指しするとサンプルの破棄でその宛先が消えたときに、
      // 検査すべきものが残っているのにゲートの側が落ちるため。
      expect(resolved.alias).toBeGreaterThan(0);
      expect(resolved.relative).toBeGreaterThan(0);
    },
    TIMEOUT_MS,
  );
});

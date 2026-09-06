import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

import {
  growthModeFor,
  hasFailure,
  judge,
  type Measurement,
  missingRoutes,
  parseBudget,
} from "./budget";
import { deferredChunks } from "./deferred";
import {
  artifactDirOf,
  entryStylesheets,
  initialChunks,
  type RouteBuildManifest,
  type RouteBundleStats,
  type RscManifest,
  sharedChunks,
  statsChunks,
  unionByRoute,
} from "./manifest";
import { renderReport } from "./report";

/**
 * client 側の資材の量を成果物から測り、予算と照らす。
 *
 * 使い方: `tsx scripts/bundle-budget [<current .next>] [<base .next>]`
 *
 * base を渡さない場合は増分を判定せず、上限だけを見る。base を渡しても増分で落とさない場合が
 * あり、その判定は `GITHUB_BASE_REF` から `growthModeFor` が下す。
 */

const BUDGET_FILE = "performance-budget.yaml";

function readJson<T>(path: string): T | undefined {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : undefined;
}

/** `__RSC_MANIFEST` を副作用なく取り出す。 */
function readRscManifest(path: string, pagePath: string): RscManifest | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  const context: { __RSC_MANIFEST?: Record<string, RscManifest> } & Record<string, unknown> = {};
  context["globalThis"] = context;
  runInNewContext(readFileSync(path, "utf8"), context);

  return context.__RSC_MANIFEST?.[pagePath];
}

/** 1 つの build 成果物から引いた計測。 */
type Survey = {
  readonly measurements: Measurement[];
  /** 2 つ以上の route が初期で読む chunk の総量（gzip した byte）。 */
  readonly sharedJs: number;
  /** 遅延として引けた chunk の総数。抽出が生きていることを報告へ載せるために持つ。 */
  readonly deferredChunkCount: number;
};

function measure(dir: string): Survey {
  const routes = readJson<Record<string, string>>(`${dir}/app-path-routes-manifest.json`);

  if (routes === undefined) {
    throw new Error(`${dir} に app-path-routes-manifest.json がありません。build しましたか。`);
  }

  // route handler は client bundle を持たない。0 KB の行を並べても読む人が得るものが無い。
  const pages = Object.entries(routes).filter(([pagePath]) => pagePath.endsWith("/page"));
  // Next 自身が数えた初期の一式。持っていない route だけ manifest の和集合へ落ちる。
  const stats = statsChunks(
    readJson<RouteBundleStats>(`${dir}/diagnostics/route-bundle-stats.json`),
  );

  // 中身を読むのは chunk 1 つにつき 1 度だけ。遅延の閉包は route をまたいで同じ chunk を辿る。
  const contents = new Map<string, string | null>();
  const read = (chunk: string): string | null => {
    const cached = contents.get(chunk);

    if (cached !== undefined) {
      return cached;
    }

    const path = `${dir}/${chunk}`;
    const content = existsSync(path) ? readFileSync(path, "utf8") : null;
    contents.set(chunk, content);

    return content;
  };

  const perEntry = pages.map(([pagePath, route]) => {
    const artifact = `${dir}/${artifactDirOf(pagePath)}`;
    const rsc = readRscManifest(`${artifact}_client-reference-manifest.js`, pagePath);
    const initial =
      stats.get(route) ??
      initialChunks(rsc, readJson<RouteBuildManifest>(`${artifact}/build-manifest.json`));

    return {
      route,
      initial,
      deferred: deferredChunks(initial, read),
      css: entryStylesheets(rsc),
    };
  });

  const byRoute = unionByRoute(perEntry);
  const shared = sharedChunks(byRoute);

  const gzip = (chunk: string): number => {
    const path = `${dir}/${chunk}`;

    return existsSync(path) ? gzipSync(readFileSync(path)).length : 0;
  };
  const sum = (chunks: readonly string[]): number =>
    chunks.reduce((total, chunk) => total + gzip(chunk), 0);

  return {
    measurements: byRoute.map(({ route, initial, deferred, css }) => ({
      route,
      initialJs: sum(initial),
      sharedJs: sum(initial.filter((chunk) => shared.has(chunk))),
      deferredJs: sum(deferred),
      css: sum(css),
    })),
    sharedJs: sum([...shared]),
    deferredChunkCount: new Set(byRoute.flatMap(({ deferred }) => deferred)).size,
  };
}

function main(): void {
  const [current = ".next", base] = process.argv.slice(2);
  const mode = growthModeFor(process.env["GITHUB_BASE_REF"]);
  const budget = parseBudget(readFileSync(BUDGET_FILE, "utf8"));
  const survey = measure(current);
  const missing = missingRoutes(survey.measurements, budget);

  if (missing.length > 0) {
    console.error(
      `❌ ${BUDGET_FILE} が上限を持つ route が build に居ません: ${missing.join(", ")}\n` +
        "route の名前を変えたなら宣言も直してください。",
    );
    process.exitCode = 1;

    return;
  }

  const previous = base === undefined ? undefined : measure(base);

  // 遅延の抽出は Turbopack の出力形式へ依存する（`deferred.ts`）。形が変われば 0 件へ落ち、
  // 「遅延なし」として静かに緑になる。base で引けていたものが引けなくなったことは、その形が
  // 変わった合図でしかないので、量の判定より先にここで落とす。
  if (
    previous !== undefined &&
    previous.deferredChunkCount > 0 &&
    survey.deferredChunkCount === 0
  ) {
    console.error(
      `❌ base では ${previous.deferredChunkCount} 件あった遅延 chunk を 1 件も引けませんでした。\n` +
        "成果物の形が変わって抽出が効かなくなった可能性があります（scripts/bundle-budget/deferred.ts）。",
    );
    process.exitCode = 1;

    return;
  }

  const verdicts = judge(survey.measurements, previous?.measurements ?? [], budget, mode);

  if (mode === "report") {
    console.log(
      "増分は表に出すだけで、判定には使いません。base が配信中のブランチで、差が変更 1 つぶんでは" +
        "ないためです。落とすのは宣言した上限だけです\n",
    );
  }

  console.log(
    renderReport(verdicts, {
      sharedJs: { current: survey.sharedJs, base: previous?.sharedJs, overGrowth: undefined },
      deferredChunkCount: survey.deferredChunkCount,
    }),
  );

  if (hasFailure(verdicts)) {
    console.error("\n❌ client 側の資材が予算を超えました。");
    process.exitCode = 1;

    return;
  }

  console.log("\n✅ client 側の資材は予算に収まっています。");
}

main();

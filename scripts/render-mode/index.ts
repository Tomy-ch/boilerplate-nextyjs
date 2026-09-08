import { existsSync, readFileSync } from "node:fs";

import {
  allowsBlocking,
  findRenderModeDrift,
  formatRenderModeDrift,
  formatRenderModeSummary,
  type PrerenderManifest,
  renderModes,
} from "./render-mode";

/**
 * 画面をどう描くかの宣言と、build がそう扱ったかを突き合わせる。
 *
 * 使い方: `tsx scripts/render-mode [<.next>]`
 *
 * build の成果物を読むので、`next build` の後に走らせる。
 */

/**
 * 突合しない route。
 *
 * @remarks
 * framework が持つ route で、アプリの判断ではありません。どちらもバックエンドから何も取らずに
 * 描けるため、Next.js は常に固めます。`favicon.ico` はそもそも画面ではありません。
 */
const EXEMPT = ["/_not-found", "/_global-error", "/favicon.ico"];

/**
 * その route を覆う segment のファイル位置を、根から順に並べる。
 *
 * @remarks
 * 宣言は page だけでなく **layout や並行 slot にも置けます**。admin のように区画ごとブロックする
 * 判断は器の側にあり、page だけを見ると宣言が無いように見えます。
 *
 * 内部の page パス（`/(site-info)/settings/page`）は route group と並行 slot を綴りに含むので、そのまま
 * 辿れば実ファイルの位置になります。
 */
function coveringSources(pagePath: string): string[] {
  const segments = pagePath.split("/").filter((segment) => segment !== "");
  const sources = ["src/app/layout.tsx"];
  let directory = "src/app";

  for (const segment of segments) {
    if (segment === "page") {
      sources.push(`${directory}/page.tsx`, `${directory}/page.dev.tsx`);
      break;
    }

    directory = `${directory}/${segment}`;
    sources.push(`${directory}/layout.tsx`);
  }

  return sources;
}

/** 読める範囲の segment を読み、1 つでもブロッキングを許していれば true。 */
function declaresBlocking(pagePaths: readonly string[]): boolean {
  return pagePaths
    .flatMap((pagePath) => coveringSources(pagePath))
    .some((source) => existsSync(source) && allowsBlocking(readFileSync(source, "utf8")));
}

function main(): void {
  const [dir = ".next"] = process.argv.slice(2);
  const routesFile = `${dir}/app-path-routes-manifest.json`;

  if (!existsSync(routesFile)) {
    console.error(`❌ ${dir} に app-path-routes-manifest.json がありません。build しましたか。`);
    process.exitCode = 1;

    return;
  }

  const routes = JSON.parse(readFileSync(routesFile, "utf8")) as Record<string, string>;
  const manifest = JSON.parse(
    readFileSync(`${dir}/prerender-manifest.json`, "utf8"),
  ) as PrerenderManifest;

  // 並行 slot は 1 つの route を複数の内部 page で組むので、route ごとに畳む。
  const pagePathsByRoute = new Map<string, string[]>();

  for (const [pagePath, route] of Object.entries(routes)) {
    if (pagePath.endsWith("/page")) {
      pagePathsByRoute.set(route, [...(pagePathsByRoute.get(route) ?? []), pagePath]);
    }
  }

  // 走査が空振りすると、違反ゼロを報告したままゲートが黙る。違反より先に「見た件数」を主張する。
  if (pagePathsByRoute.size === 0) {
    console.error("❌ page を 1 枚も読めませんでした。成果物と `src/app` の対応が崩れています。");
    process.exitCode = 1;

    return;
  }

  const declared = new Map(
    [...pagePathsByRoute].map(([route, pagePaths]) => [route, declaresBlocking(pagePaths)]),
  );
  const observed = renderModes(manifest);
  const drift = findRenderModeDrift(observed, declared, EXEMPT);

  if (drift.length > 0) {
    console.error(
      `❌ 描画モードの宣言と実態が食い違っています。\n\n${formatRenderModeDrift(drift)}`,
    );
    process.exitCode = 1;

    return;
  }

  console.log(formatRenderModeSummary([...pagePathsByRoute.keys()], observed, EXEMPT));
}

main();

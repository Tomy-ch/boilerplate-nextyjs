/**
 * build 成果物から、route ごとに browser が読む資材を引く。
 *
 * @remarks
 * 初期 JS は Next.js 自身が数えた {@link RouteBundleStats} を正とし、それが持たない route だけ
 * manifest の和集合（{@link initialChunks}）へ落とします。CSS は `entryCSSFiles`、遅延の側は
 * `deferred.ts` が引きます。
 *
 * **なぜ 4 つを測るのかは [0101](../../docs/adr/0101-performance-budget.md) §2 が持ちます。**
 *
 * `polyfillFiles` を数えないのは、Next.js がそれを `<script nomodule>` で出すためです。
 * [0102](../../docs/adr/0102-browser-support.md) が対応対象とするブラウザ（Next.js 既定の
 * browserslist = モダン）は一度も取得しません。
 */

/** `__RSC_MANIFEST` の 1 route ぶん。必要な形だけを受け取る。 */
export type RscManifest = {
  readonly clientModules?: Readonly<Record<string, { readonly chunks?: readonly string[] }>>;
  readonly entryCSSFiles?: Readonly<Record<string, readonly { readonly path: string }[]>>;
};

/** route ごとの `build-manifest.json`。必要な形だけを受け取る。 */
export type RouteBuildManifest = {
  readonly rootMainFiles?: readonly string[];
};

/**
 * `next build` が自分で書き出す route ごとの初期 JS（`.next/diagnostics/route-bundle-stats.json`）。
 *
 * @remarks
 * Next.js 自身が `entryJSFiles` から数えた一次情報です。**こちらを正とします。** manifest から
 * 和集合を組み直すと、Next が初期の一式として扱う chunk を取りこぼします（同梱サンプルの実測で
 * 1 route あたり約 3.6 KB。`clientModules` は client component の参照ごとの entry で、route の
 * 初期の一式そのものではありません）。数える範囲もこちらと同じで、CSS と polyfill を含みません。
 *
 * ただし**全 route を持つわけではありません**（同梱サンプルでは `/_global-error` が欠けます）。
 * 欠けた route は {@link initialChunks} の和集合へ落とします。
 */
export type RouteBundleStats = readonly {
  readonly route: string;
  readonly firstLoadChunkPaths?: readonly string[];
}[];

/**
 * `route-bundle-stats.json` を route ごとの chunk へ。
 *
 * @param stats - 読めなかった場合は省略。空の Map が返り、呼び出し側は和集合へ落ちる。
 * @returns 公開 route から、成果物ディレクトリからの相対パスへの対応。
 */
export function statsChunks(stats: RouteBundleStats | undefined): Map<string, string[]> {
  return new Map(
    (stats ?? []).map(({ route, firstLoadChunkPaths }) => [
      route,
      (firstLoadChunkPaths ?? []).map(toArtifactPath),
    ]),
  );
}

/**
 * chunk の参照を成果物ディレクトリからの相対へ均す。
 *
 * @remarks
 * 出所ごとに綴りが違います。manifest は `/_next/static/...`、`route-bundle-stats.json` は
 * build を回した場所から見た `.next/static/...` で書きます。同じ chunk が 2 通りに数えられる
 * のを防ぐため、入口で 1 つへ寄せます。
 */
function toArtifactPath(reference: string): string {
  return reference.replace(/^\/?_next\//, "").replace(/^\.next\//, "");
}

/**
 * route が最初に読む JavaScript chunk。
 *
 * @remarks
 * CSS など JavaScript でないものは落とします。予算が見るのは client JS の量です。
 *
 * @param rsc - その route の `__RSC_MANIFEST` の値。route が client component を持たない場合は省略。
 * @param build - その route の `build-manifest.json`。
 * @returns 重複を畳んだ、成果物ディレクトリからの相対パス。
 */
export function initialChunks(
  rsc: RscManifest | undefined,
  build: RouteBuildManifest | undefined,
): string[] {
  const found = new Set<string>();

  for (const entry of Object.values(rsc?.clientModules ?? {})) {
    for (const chunk of entry.chunks ?? []) {
      found.add(toArtifactPath(chunk));
    }
  }

  for (const chunk of build?.rootMainFiles ?? []) {
    found.add(toArtifactPath(chunk));
  }

  return [...found].filter((chunk) => chunk.endsWith(".js"));
}

/**
 * route が最初に読む CSS。
 *
 * @remarks
 * `entryCSSFiles` は route の木に居る entry（layout / page / error / 並行ルート）ごとに並びます。
 * 開いたときに読まれるのはその和なので、初期 JS と同じく和集合で数えます。
 *
 * @param rsc - その route の `__RSC_MANIFEST` の値。
 * @returns 重複を畳んだ、成果物ディレクトリからの相対パス。
 */
export function entryStylesheets(rsc: RscManifest | undefined): string[] {
  const found = new Set<string>();

  for (const entry of Object.values(rsc?.entryCSSFiles ?? {})) {
    for (const file of entry) {
      found.add(toArtifactPath(file.path));
    }
  }

  return [...found];
}

/**
 * `app-path-routes-manifest.json` の内部 page パスから、成果物のディレクトリを組み立てる。
 *
 * @remarks
 * 内部パスは `/(site-info)/reports/page` のように末尾が `page` / `route` で、成果物は
 * `server/app/(site-info)/reports/page/` に置かれます。route group の括弧はそのまま残ります。
 *
 * @param pagePath - `app-path-routes-manifest.json` の key。
 */
export function artifactDirOf(pagePath: string): string {
  return `server/app${pagePath}`;
}

/** 公開 route 1 つぶんの、成果物から引いた資材。 */
export type RouteChunks = {
  /** 公開 route。 */
  readonly route: string;
  /** 初期に読む JS。 */
  readonly initial: readonly string[];
  /** 遅延で読みうる JS。 */
  readonly deferred: readonly string[];
  /** 初期に読む CSS。 */
  readonly css: readonly string[];
};

/**
 * 同じ公開 route を指す entry の資材を 1 つへ畳む。
 *
 * @remarks
 * `app-path-routes-manifest.json` の key は成果物の単位であって公開 route の単位ではありません。
 * **並行ルート（`@slot`）を持つ route は entry を複数持ち、その全てが同じ公開 route を指します。**
 * 開いたときの HTML はページとスロットの両方の script を持つので、量は和集合で数えます。
 *
 * entry ごとに数えると、同じ route が複数行に割れるだけでなく、上限も増分もそのうちの 1 つしか
 * 見ません。増分は route 名を鍵に base と突き合わせるので、どの entry が鍵に残るかで結果が変わり
 * ます。
 *
 * @param entries - manifest の entry ごとに引いた資材。manifest に現れた順で渡します。
 * @returns 公開 route ごとの資材。順序は最初に現れた entry の順。
 */
export function unionByRoute(entries: readonly RouteChunks[]): RouteChunks[] {
  const byRoute = new Map<
    string,
    { initial: Set<string>; deferred: Set<string>; css: Set<string> }
  >();

  for (const entry of entries) {
    const found = byRoute.get(entry.route) ?? {
      initial: new Set<string>(),
      deferred: new Set<string>(),
      css: new Set<string>(),
    };

    for (const chunk of entry.initial) found.initial.add(chunk);
    for (const chunk of entry.deferred) found.deferred.add(chunk);
    for (const chunk of entry.css) found.css.add(chunk);

    byRoute.set(entry.route, found);
  }

  return [...byRoute].map(([route, found]) => ({
    route,
    initial: [...found.initial],
    // 別の entry が初期で読むものは、この route にとって遅延ではない。
    deferred: [...found.deferred].filter((chunk) => !found.initial.has(chunk)),
    css: [...found.css],
  }));
}

/**
 * 2 つ以上の route が初期で読む chunk。
 *
 * @remarks
 * 共有が 8 KB 増えれば route ごとの行はすべて +8 KB として並びますが、原因は 1 つです。報告の側で
 * 1 度だけ出すために、どれが共有かをここで決めます。
 *
 * テンプレートから作った側に route が 1 つしかなければ全てが固有になりますが、そのとき共有の内訳は情報を持たないので
 * それで正しい判定です。
 *
 * @param byRoute - 公開 route ごとの資材。
 */
export function sharedChunks(byRoute: readonly RouteChunks[]): Set<string> {
  const count = new Map<string, number>();

  for (const { initial } of byRoute) {
    for (const chunk of initial) {
      count.set(chunk, (count.get(chunk) ?? 0) + 1);
    }
  }

  return new Set([...count].filter(([, routes]) => routes > 1).map(([chunk]) => chunk));
}

# Cache Components(PPR)有効化判断

`Cache Components`(PPR 既定化 = `next.config.ts` の `cacheComponents: true`)の採否を、[0010](0010-standards-and-non-lockin.md) の標準準拠・非ロックイン判断軸の下で定める。レンダリングモードの選択は [0040](0040-routing-rendering-strategy.md) が、データ取得のキャッシュ・再検証は [0071](0071-bff-api-integration.md) が、Suspense 境界の配置は [0080](0080-error-handling.md) が持ち、本 ADR はそれらの上で **PPR を採るかどうか** の 1 点だけを持つ。

## Status

Accepted

## 背景

この判断は、データ取得のキャッシュ設計([0071](0071-bff-api-integration.md))・env のプリレンダー凍結([0030](0030-environment-variable-management.md))・Suspense 境界の配置([0080](0080-error-handling.md))と交差する。いずれも確定しているため、本 ADR は採否だけを扱う。

裏取り(`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`): `cacheComponents` は 16.0.0 で導入され、従来の `ppr` / `useCache` / `dynamicIO` を **1 つに統合**した設定である。有効化するとデータ取得は明示 `use cache` しない限りプリレンダーから除外され、`use cache` を page / function / component 粒度で置く運用が前提になる。さらに有効時は client-side navigation で React `<Activity>` により旧ルートを unmount せず **state を保存**する(遷移意味論そのものが変わる)。

## 決定

### Cache Components(PPR)を採用する(`cacheComponents: true`)

- **有効化する。** [0040](0040-routing-rendering-strategy.md) が保留した判断を、本 ADR が「採用」に確定する。
- **根拠は実測である。** 器の layout で cookie を読む 2 つの取得(利用者ごとの状態とセッション)を `<Suspense>` の穴へ落とすと、静的な本文だけの画面・識別子で 1 件を引く画面を含む 8 枚が**部分プリレンダーへ入る**。取得を持たない画面の静的な殻は header・nav・footer・本文を含む 12.4 KB の HTML で、**バックエンドへ 1 度も行かずに配れる**。この分割を持たない限り、同じ画面は器が読む 2 つの往復を待ってから 1 バイト目を返す。**入口の画面は追加の分割なしにこの形へ入る** —— 見出しを `Suspense` の外、取得を内に置く形で書かれているためである。
- **待つコストが実在する。** 殻と穴の分割・`use cache` の粒度は route の構造そのものであり、後から入れることは同じ画面を二度書くことを意味する。
- **有効化の前提は [0112](0112-data-classification-cache-boundary.md)** のデータ分類とキャッシュ境界である。PPR は「何が静的な殻へ入るか」を決める機構であり、**分類が無いまま有効化すると事故の面だけが先に開く**。
- **PPR は public data に対する性能最適化として扱う。** user-scoped な値については、共有・静的キャッシュの恩恵より機密性を優先する([0112](0112-data-classification-cache-boundary.md) 不変条件 1 / 2)。
- **器の形が殻と穴の分かれ目そのものになり**、次が実装の作法として効く。
  - **描くモードを画面が宣言しない。** segment config は併存しない。`params` / `searchParams` / cookie / 認可の判定 / 実時計は、すべて穴の内側で解く(実時計はさらに `connection()` を待ってから読む)
  - **殻を配れない画面だけが `export const instant = false` を理由つきで名乗る。** 宣言と実態の突合は `scripts/render-mode` が `prerender-manifest.json` の `compute` に照らし、宣言なしにブロックしている route と、宣言が余っている route の双方を見る
  - **現在地を読む client 部品も穴を要る。** `usePathname` / `useSearchParams` は動的な区間を持つ route の殻では解決できない
  - **認可で殻を配れない区画は、区画ごと名乗る。** 判定を穴へ落とすと、確かめる前にその面の殻が誰にでも配られる([0079](0079-auth-frontend-seam.md))
  - **一次資源が見つからないことは 200 で伝わる。** 殻を配り始めた時点でヘッダは 200 で出ており、その後 `notFound()` / `redirect()` に達してもステータスは変えられない。`instant = false` でも変わらない —— 有効時は動的な route が必ず殻から流れるためである。見つからないことは `noindex` と見つからない画面が伝える([0080](0080-error-handling.md) §4)
- **引き受ける代償**(採用によって発生し、消えないもの):
  - **可逆性の低下**: 無効 → 有効は `use cache` を足す前進移行だが、有効前提で書いたツリー(静的な殻 / 動的な穴の分割・`use cache` の粒度)を無効へ戻すのは書き直しになる。採用はこれを引き受ける。
  - **キャッシュ設計の骨格を本体が持つこと**: 「何を `use cache` するか / どの粒度で」は [0071](0071-bff-api-integration.md) が具体値を開けてある領域である。**具体値は開けたまま、寿命をどこへ置くかの骨格だけを本体が決める**。
  - **一次資源の不在を示すステータスを失うこと**: `notFound()` / `redirect()` は殻が流れた後に達するため、応答は 200 のままとなり、`noindex` メタタグと meta refresh へ落ちる。索引は `noindex` が防ぐが、**ステータスで判定する監視・DAST・非 JS クライアントからは成功と区別できない**。Next 自身が案内する回避は `proxy` での事前確認だが、それは [0043](0043-middleware-policy.md)(cookie を読むだけの前捌き)と [0079](0079-auth-frontend-seam.md)(防御線ではない)に反するため採らない。この代償を引き受ける([0080](0080-error-handling.md) §4)。
  - **組み立てがバックエンドへの到達性を要求すること**: `use cache` を持つ口はキャッシュの中身を作るために build 中にも呼ばれる。取得先へ到達できない環境では build が落ちる —— 取得がすべて穴に居るなら落ちない。**フロントとバックエンドを別に運ぶ構成([0011](0011-no-docker.md))では、build を回す場所から取得先へ届くかどうかが前提になる**。`APP_API_MODE=mock` のときは `pnpm build` が契約から生成したハンドラを HTTP の口として立てて自給する —— プリレンダーは別の worker プロセスで走るので、プロセス内の interception(`src/instrumentation.ts` / `next.config.ts`)では届かない(どちらも実測で確認した)。request 時の往復を減らすことと引き換えに受け取る([0071](0071-bff-api-integration.md))。
  - **キャッシュの永続性が配備先次第になること**: `use cache` の既定の入れ物はプロセスのメモリで、デプロイをまたがない(鍵に build ID が入る)。[0011](0011-no-docker.md) が挙げる配備先はいずれも serverless 側にあたるため、**request 時の再利用は起きる回と起きない回がある**。確実に残るのは組み立て時に殻へ焼かれた分だけであり、これは `fetch` の Data Cache(デプロイとインスタンスをまたいで残る)から失うものである。埋め合わせる手段(`cacheHandlers` / `use cache: remote`)は配備先に依存するので本体では選ばない([0010](0010-standards-and-non-lockin.md))。
  - **遷移意味論の変更**: 全ルートの client-side navigation が `<Activity>` により状態保存挙動へ変わる(前の route を unmount せず hidden にする)。dropdown / dialog / 一覧の位置復元への影響は E2E と VRT で見る。
- **有効化後のキャッシュモデル**は `use cache` + `cacheLife` / `cacheTag` を正とする。キャッシュ指定の所有層(`adapters` / 呼び出す RSC)・tag 命名・profile の形(殻へ載る取得の profile に `expire` を置かず、取り直しを背後で起こす)・ミューテーション後 revalidate の規約は [0071](0071-bff-api-integration.md)「データ取得のキャッシュ・再検証」節が正であり、**user-scoped な値は [0112](0112-data-classification-cache-boundary.md) に従い既定で uncached** とする。

## 禁止事項

- ❌ [0112](0112-data-classification-cache-boundary.md) の分類とキャッシュ境界が無い状態で有効化すること
- ❌ キャッシュヒット率や PPR 適用率を理由に、user-scoped な値を静的な殻・共有キャッシュへ載せること([0112](0112-data-classification-cache-boundary.md))
- ❌ `export const instant = false` を、応答ステータスを 404 / 3xx へ戻す手段として使うこと(戻らない。有効時は動的な route が必ず殻から流れる)

## 補足

- 本 ADR は [0140](0140-documentation-operations.md) のタクソノミーにおいて **decision** 分類に属する。
- `use cache` の粒度・静的な殻 / 動的な穴の分割は [0071](0071-bff-api-integration.md) のキャッシュ節が、[0030](0030-environment-variable-management.md) の env プリレンダー凍結との整合は同 ADR が、Suspense × PPR は [0080](0080-error-handling.md) §4 が持つ。
- ページネーション / 無限スクロールのデータ取得境界は本 ADR の対象外であり、[0073](0073-pagination-fetch-boundary.md) が所有する。無限スクロールの初回 RSC 取得が拠って立つキャッシュモデルは本 ADR の確定に従う。

## 関連 ADR

- [0073-pagination-fetch-boundary.md](0073-pagination-fetch-boundary.md) — ページネーション / 無限スクロールのデータ取得境界(本 ADR のキャッシュモデルの上に乗る)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — レンダリングモード非強制(本 ADR が `Cache Components` の採用を確定)
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — データ取得のキャッシュ・再検証(既定 uncached・opt-in・所有層・profile)
- [0112-data-classification-cache-boundary.md](0112-data-classification-cache-boundary.md) — データ分類とキャッシュ境界(本 ADR の有効化の前提)
- [0080-error-handling.md](0080-error-handling.md) — §4 Suspense × PPR(殻から流れる応答のステータス)
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — env プリレンダー凍結(Cache Components 判断との交差)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠・非ロックイン判断軸(本 ADR の vendor-independent 正当性材料の根拠)

# ページネーション・無限スクロールのデータ取得境界

一覧画面の **ページネーション / 無限スクロール** のデータ取得境界を定める。[0040](0040-routing-rendering-strategy.md) は「レンダリングモードを強制しない」までを持ち、データ取得のキャッシュ設計は [0071](0071-bff-api-integration.md)、`loading.tsx` / Suspense 境界は [0080](0080-error-handling.md) が持つ。その上で、無限スクロールが必然的に伴う client 追加取得は、[0060](0060-state-management.md) の「Server state = RSC fetch 既定 / クライアントでのデータ取得を本体で前提にしない」と正面から緊張し、[0071](0071-bff-api-integration.md) の fetch wrapper(resilience は主に `adapters/server` に適用 = server 前提)でもカバーされない。本 ADR はこの取得境界の所有者を明示し、[0010](0010-standards-and-non-lockin.md) の標準準拠・非ロックイン判断軸の下で確定する。

## Status

Accepted

## 背景

一覧画面の頁送り・無限スクロールの UI 側扱い(offset vs cursor、ページ状態の表現、client 追加取得の可否)は、所有者を明示しなければ feature ごとに発明される。とりわけ無限スクロールは `IntersectionObserver` + client fetch を必然的に伴い、[0060](0060-state-management.md) の既定と緊張する。加えて、その client fetch 経路は [0071](0071-bff-api-integration.md) の fetch wrapper(server 前提)ではカバーされず、所有者が無いままだと生 `fetch` がコンポーネントへ散る。本 ADR は、大半の一覧を RSC 駆動の既定の内側に収めたうえで、無限スクロールの増分取得だけを限定した例外として所有者付きで置く。

## 決定

### 1. ページネーションは cursor 既定・ページ状態は searchParams(RSC 駆動 = 0060 の内側)

- **cursor ページネーションを既定**とする。offset は「小さく安定した集合」または「ページ番号ジャンプが要件」の場合に限り許容する。
  - **vendor-independent な正当性材料**: cursor はデータの挿入 / 削除に対して安定(境界がずれても行のスキップ・重複が起きない)であり、offset は挿入 / 削除でページ境界がずれる。これは一般的なデータ整合の性質であって Next.js 非依存の根拠である。
- **cursor で移動できるのは前後 1 ページずつ**である。cursor は「次の位置」を指す不透明な値で、任意の位置へ跳ぶ手段を表さない。**戻る先は URL が覚える** —— cursor は次の位置しか指さないため、通ってきたページの起点を URL 以外の場所が持つと前へ戻れない。
- **ページ状態(現在ページ / cursor)は searchParams で表現**する([0060](0060-state-management.md) の「URL state は Next.js 標準機構」に乗る)。ブックマーク・共有・戻る操作が正しく復元できる。
- **条件が変われば、読み進めた位置は捨てる。** 絞り込み・並び順が変わったとき、ページ位置(ページ / cursor)を持ち越さない。前の条件の途中の位置は、新しい条件では別の場所を指す。母集団が変われば位置が意味を失うのは業務ではなくページングの性質であり、どの一覧にも同じように効く。
- 頁送り(前 / 次)は **searchParams 駆動で RSC が再取得する既定経路**とする。これは 0060 の「Server state = Server Component fetch 既定」の**内側**であり、例外を要さない。したがって**大半の一覧は client 追加取得を持たずに成立する**。

### 2. 無限スクロールの client 追加取得は限定した明示例外・所有は `adapters/client`

- 無限スクロール(`IntersectionObserver` による末尾到達検知 + 追加取得)は client fetch を必然的に伴うため、[0060](0060-state-management.md) の「クライアントでのデータ取得を本体で前提にしない」既定に対する **明示的で限定された例外**として扱う。例外は狭く保つ:
  - **初回ページは RSC 取得**(§1)。client fetch は「もっと見る」の**増分取得だけ**に限る。
  - **所有 = `adapters/client`**: client の追加取得は生 `fetch` をコンポーネントに散らさず、必ず **`adapters/client`([0024](0024-adapters-server-client-split.md) = client 側 remote IO の所有境界。同一オリジン BFF fetch が主で、ADR が明示に許す同一オリジン外への送信も同層が所有)経由**で行う。resilience(dual timeout / retry / breaker)は server 側 = `adapters/server`([0071](0071-bff-api-integration.md))が持ち、本 ADR の client 追加取得は same-origin(`/api/*` BFF / Route Handler)への薄い fetch に留める。これにより **0071 wrapper が server 前提でカバーしない client 経路の所有者を明示**する。
  - **トリガー hook**(末尾到達を検知する reactive client hook)は既定で **feature ローカル**([0060](0060-state-management.md) client state = local から)。複数 feature を跨ぐ横断が生じた時点で **`capabilities` カーネル([0022](0022-capabilities-kernel.md))へ昇格**する([0021](0021-frontend-responsibility.md) 昇格ルール)。
  - **URL 復元性の優先**: 可能な限り searchParams 駆動の「もっと見る」ボタン(RSC 再取得)を優先し、真の無限スクロールは体感上それが要る箇所に限定する。無限スクロール採用時も、読み進めた件数を URL へ書き戻し、現在 cursor を URL / state から復元可能に保つ。書き戻さないと、戻る操作も再読み込みも先頭の 1 ページだけの画面に戻り、読み進めた分がスクロール位置ごと失われる。復元できるのは契約が受け付ける件数の上限までであり、書き戻しは履歴を積まない(戻る操作は一覧より前の画面へ抜ける)。
- client 追加取得の response も **`adapters` 境界で runtime validation・エラー正規化**を通す([0071](0071-bff-api-integration.md) / [0080](0080-error-handling.md))。生 status・生エラーを UI へ漏らさない原則は client 経路でも同じである。
- **積み上げを捨てる判断は、取得する hook が持たない。** 別の一覧になったかどうかは、置く側が
  React の鍵で表し、フレームワークに作り直させる。hook が初回ページの差し替えを見張ると、内容が
  同じまま作り直されただけ(サーバが同じ結果を返し直したとき)でも巻き戻り、読み進めた分と
  スクロール位置が失われる。**参照同一性で見張るのは特に誤りで、サーバが毎回新しい値を組む以上
  常に真になる。**
- **資格情報切れは「続きの取得の失敗」として扱わない。** 認証の内側にある一覧では、読み進めて
  いる最中に session が切れうる。これを再試行できる失敗と同じ状態に畳むと、画面に出せるのは
  読み直す操作だけになり、押しても同じ経路を辿るので利用者は抜け出せない。**未認証のとき
  どこへ送るかは route の確定認可([0079](0079-auth-frontend-seam.md))が既に持っているので、
  サーバへ描き直しを頼んでその判断へ委ねる**(`router.refresh()`)。ここで送り先を決めると
  同じ決定が 2 か所に増える。
- **データ取得ライブラリ(TanStack Query 等)は引き続き同梱しない**([0060](0060-state-management.md) exclusion を破らない)。増分取得の状態は local state / `adapters/client` の薄い呼び口で足りる範囲に留める。

## 禁止事項

- ❌ ページ状態(現在ページ / cursor)を searchParams 以外(コンポーネント state のみ 等)に閉じ込め、ブックマーク・共有・戻る操作で復元不能にすること(§1)
- ❌ 挿入 / 削除が起きるデータで安易に offset ページネーションを既定にすること(cursor 既定。offset は限定条件のみ)
- ❌ 絞り込み・並び順を変えたときにページ位置を持ち越すこと(§1。前の条件の位置は新しい条件では別の場所を指す)
- ❌ 無限スクロール / 追加取得の client fetch を**生 `fetch` でコンポーネントに直接書く**こと(必ず `adapters/client` 経由。§2 / [0024](0024-adapters-server-client-split.md))
- ❌ client 追加取得に resilience(timeout / retry / breaker)を **client 側で独自実装**すること(resilience は server = `adapters/server` が持つ。client は same-origin の薄い fetch)
- ❌ client 追加取得の response を検証・正規化せず UI へ流すこと([0071](0071-bff-api-integration.md) / [0080](0080-error-handling.md) の境界原則は client 経路にも適用)
- ❌ 増分取得の hook が初回ページの差し替えを見張って積み上げを捨てること(§2。置く側の鍵が持つ)
- ❌ 資格情報切れ(401)を、再試行できる失敗と同じ状態へ畳むこと(§2。再試行導線は 401 では誤り)
- ❌ 無限スクロールを理由にデータ取得ライブラリを持ち込むこと([0060](0060-state-management.md) exclusion)

## 補足

- 日常強制される rule(頁送り UI の細部・スケルトン等)は [docs/rules.md](../rules.md) が持つ。
- Cache Components(PPR)有効化判断は本 ADR の対象外であり、[0041](0041-cache-components-decision.md) が所有する。無限スクロールの初回 RSC 取得が拠って立つキャッシュモデルは 0041 と [0071](0071-bff-api-integration.md)「データ取得のキャッシュ・再検証」に従う。

## 関連 ADR

- [0041-cache-components-decision.md](0041-cache-components-decision.md)— Cache Components(PPR)有効化判断(初回 RSC 取得が乗るキャッシュモデルの所有者)
- [0060-state-management.md](0060-state-management.md)— Server state = RSC fetch 既定 / URL state = Next 標準機構(本 ADR §1 の土台)/ client 取得非前提(本 ADR §2 が限定例外を追加)/ データ取得ライブラリ非同梱
- [0071-bff-api-integration.md](0071-bff-api-integration.md)— データ取得のキャッシュ・再検証 / fetch wrapper resilience は `adapters/server` 前提(本 ADR §2 の client 経路の対)
- [0080-error-handling.md](0080-error-handling.md)— `adapters` 境界のエラー正規化(本 ADR §2 の client 追加取得 response にも適用)
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md)— `adapters/client`(client 側 remote IO の所有境界。同一オリジン BFF fetch が主。本 ADR §2 の client 追加取得の所有者)
- [0022-capabilities-kernel.md](0022-capabilities-kernel.md)— 横断 client hook の昇格先(無限スクロールのトリガー hook が cross-feature 化した時の家)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md)— 標準準拠・非ロックイン判断軸(本 ADR の vendor-independent 正当性材料の根拠)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md)— 昇格ルール(feature ローカル → capabilities)

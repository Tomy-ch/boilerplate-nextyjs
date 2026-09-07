# データ分類とキャッシュ境界(PII / user-scoped)

値を「**どの実行境界・どのキャッシュ範囲で使ってよいか**」で分類し、誤った置き場へ入れる書き方を**通常の実装経路から消す**。分類の持たせ方(値ではなく取得の口)、関所の置き場と各関所が見えるもの、および分類・PPR・taint・React Compiler の責務分界を定める。[0111](0111-csp-security-headers.md) が応答ヘッダの本体を持つのに対し、本 ADR は**値が通る道のりのどこで何を止めるか**を持つ。

## Status

Accepted

## 背景

Cache Components(PPR)を有効化すると、**user-scoped な値が共有・静的な領域へ載る経路が新たに生まれる**。User A の個人データが共有キャッシュへ入り User B へ配られる事故は、表示層で起こしうる中で最も損害が大きい。

規約([`docs/rules.md`](../rules.md) #79b「Data Cache へ入れてよいのは、主体を名乗らずに取れるものだけ」)だけでは止まらない。`adapters/server/http` の `RequestSpec` が `cache` / `tags` を**どの client でも受け取れる**形なら、資格情報を載せる口に `cache: "force-cache"` を渡す書き方が型検査を通る。**要るのは強制**である。

[0030](0030-environment-variable-management.md) §8 は Server → Client の誤送信に対する防御を持つ。**キャッシュ側の境界は本 ADR が持つ。**

## 不変条件

本 ADR の決定はすべて、次の 6 つを満たすために置かれている。**個々の決定より不変条件が優先する。**

1. **PII / user-scoped データの機密性は、レンダリング最適化より優先する**
2. **共有・静的キャッシュの能力は、public な取得経路にのみ与える**
3. **user-scoped データは既定で request-scoped かつ uncached とする**
4. **PII のための CSR は許可するが、その Client Island は必要最小限にする**
5. **Server → Client 境界を越える PII は、必要最小限の Client DTO へ詰め替える**
6. **SSR-First / PPR / React Compiler 等の性能方針は、PII 境界を緩める理由にならない**

**PII はレンダリング最適化の対象ではなく、露出範囲を最小化する対象である。** 性能最適化はその機密性制約の内側でのみ行う。優先順位は次のとおりで、上が下を常に上回る。

```text
機密性 > キャッシュ効率 > SSR 率 > PPR 適用率 > バンドル最小化
```

## 決定

### 1. 分類は値ではなく「取得の口」に持たせる

値を包む方式(`PublicData<T>` / `UserScopedData<T>` のようなラッパ型)は**採らない**。

- **unwrap で分類が消える。** `wrapped.value.email` と書いた瞬間に `string` へ戻り、保証は最初の描画地点で切れる。そこは PII が正当に出ていく場所であり、**保証が要る場所には届かない**
- 代わりに全 feature が包み / 解きの記述を払う。**費用は全行に、効果は 2 箇所にしか出ない**

事故が起きる面は **キャッシュへ入れる瞬間**と **client へ渡す瞬間**に集中している。したがって分類は、値が生まれる場所 = **取得の口(`adapters/server/http` の client)**に宣言し、**その口が受け取れる引数を分類ごとに変える**。

```ts
createHttpClient({ scope: "public" })       // cache / tags を受け取る。資格情報の口は持たない
createHttpClient({ scope: "user-scoped" })  // 資格情報を載せられる。cache / tags を型として持たない
```

**「PII を共有キャッシュへ入れるな」を注意書きではなく、引数の不在にする。** 不在は両側に置く —— public な口は資格情報の取得口そのものを型として持たない。分類が「その client が資格情報を載せるか」を言い当てられなければ、口に分類を持たせた意味が無い。

### 2. 分類と、許される置き場

| 分類 | 何か | 許される置き場 |
| --- | --- | --- |
| **public** | 主体を名乗らずに取れるもの(マスタ・公開カタログ) | 静的描画 / 共有キャッシュ / PPR の静的な殻 / client 送信 |
| **user-scoped** | 主体に紐づくもの(プロフィール・カート・購入・ダッシュボード) | request scope / 動的 RSC。**共有キャッシュと静的生成は不可**。client へは詰め替えた後のみ |
| **secret** | 署名鍵・トークン | server 内部のみ。キャッシュ・静的描画・client DTO・client 送信のいずれも不可 |

**`secret` はこの取得経路を通らない。** `config/*.server.ts` に閉じ、`import "server-only"` と [0030](0030-environment-variable-management.md) §8 の taint が持つ。**値の数が少なく描画へ出ないため、こちらは branded / opaque な値型が費用に見合う**(包むのは secret だけ)。

### 3. 資格情報を載せうる口は、載せなかった回も含めて user-scoped

匿名でも呼べる口(`allowAnonymous`)であっても、資格情報を載せうるなら分類は user-scoped である。**分類は口の性質であって要求ごとの結果ではない**ため、静的に決まり型で塞げる。

user-scoped な値をキャッシュしたい場合の唯一の手段は **`use cache: private`**(サーバへ保存されず、ブラウザのメモリにのみ載る)とする。

ただし **`use cache: private` は「user-scoped をキャッシュしてよい」という一般許可ではない。** 明示的な例外能力として扱い、**必要性を説明できる箇所にのみ**使う。既定は不変条件 3 のとおり uncached である。

### 4. 関所は段として置く。一箇所で全部を守らない

値が通る道のりには、**その場所でしか見えないもの**がある。したがって守りは 1 か所に集約せず、段ごとに置く。

| 段 | 止めるもの | 手段 | 検出時点 |
| --- | --- | --- | --- |
| **取得の口** | user-scoped の取得に `cache` / `tags` を渡す | 型(引数の不在) | typecheck |
| **キャッシュ投入前** | `use cache` を持つモジュールから user-scoped adapter を import する | lint(`project-rules/no-user-scoped-in-cached-module`) | `lint:ci` |
| **描画** | cached scope からの `cookies()` / `headers()` 読み出し。資格情報が cookie 由来であるため、user-scoped な取得を `use cache` の下へ置くと `next-request-in-use-cache` で落ちる | framework | build または実行時 |
| **取得時** | 型を迂回して組まれた spec のキャッシュ指定と、呼び出しごとに持ち込まれた資格情報のヘッダ | `adapters/server/http` の関門 | 要求時に throw |
| **client 送信前** | server object をそのまま client へ渡す | taint([0030](0030-environment-variable-management.md) §8) | 描画時 |
| **配信** | user-scoped な応答が共有キャッシュへ載る(CDN / プロキシ) | 応答ヘッダ。session cookie を載せた要求への応答に `src/proxy.ts` が `Cache-Control: private, no-store` を付ける([0111](0111-csp-security-headers.md) §5) | 応答時 |

**どの段も、他の段が見えないものを見ている。** 取得の口だけでは `use cache` を書かれた時点で外れ、taint だけでは派生値とコピーで抜け、ヘッダだけではアプリ内部の共有キャッシュに効かない。

**段 2 の判定はモジュール単位で、口の分類の綴りを読む。** 名前ごとに口へ辿り着くかを追う解析はこの段の役目に見合わないので、口と純粋な変換が同居するモジュールは変換だけを引いても止まる —— 止まったほうを直す(変換が自分のモジュールを持つ)。綴りを定数へ寄せると段そのものが黙るため、綴りが残っていることを別の口が見張る。

### 5. 「資格情報は使用地点で cookie から解決する」を規約として機械検査する

段 3(framework)の防御は、**資格情報が使用地点で `cookies()` から解決されること**にぶら下がっている。トークンをモジュール変数へ置く、引数で持ち回る、境界をまたいでメモ化する —— いずれでも **この防御は何も言わずに外れる**。

したがってこの前提自体を規約とし、機械検査の対象とする。段を増やしても、増えた段が同じ前提に乗る限り薄くならない。**閉じ方は層の追加ではなく、前提を検査可能にすることである。**

検査の形は「**資格情報の取得口には import した口だけを渡せる**」とする(`project-rules/no-captured-bearer-token`)。その場で組んだ関数は掴んだ値を隠せるが、import された口は宣言が 1 か所にあり、そこを読めば解決の経路が分かる。

**例外は session を確立する 1 往復だけである。** その時点では cookie がまだ無く、cookie から解決する口は存在しない。この 1 か所は `bearerToken`(解決済みの値)という別の綴りで渡す。**綴りを分けるのは、防御が外れる箇所を数えられるようにするため**であり、渡してよい場所が増えたのではない。

**したがって例外の綴りも同じ検査が見る。** `bearerToken` へ渡せるのは**囲む関数がその呼び出しで受け取った引数**だけとする —— 確立中のトークンは呼び出しと一緒に届くものだからである。数えられるだけでは足りない: 周囲の adapter はクライアントをモジュール変数へ固定する形を採っており、その形へこの綴りを持ち込むと、最初の要求のトークンがプロセスの寿命だけ居座って以後の全員がその主体として出ていく。**例外に強制が無ければ、例外は迂回路になる。**

### 6. 責務を混同しない

| 機構 | 担当 |
| --- | --- |
| 分類 + 取得の口 | **どこで使ってよいか**を型と引数で制約する |
| PPR / Cache Components([0041](0041-cache-components-decision.md)) | 共有・静的領域への誤投入を防ぐ(キャッシュ方針の側) |
| taint([0030](0030-environment-variable-management.md) §8) | Server → Client の誤送信を実行時に検知する |
| React Compiler([0042](0042-react19-rendering-api.md)) | **性能最適化のみ。** PII / キャッシュ / セキュリティ境界とは独立で、opt-in |

**React Compiler は PII 保護機構ではない。** 本 ADR の設計から切り離す。

### 7. 本 ADR が定める機構は基盤であり、サンプル破棄後も残る

分類・キャッシュ境界・taint adapter は、サンプル API 固有の仕組みではなく **Server / Client 境界とキャッシュ境界そのものを守る機能**である。破棄対象の宣言に含めない。

### 8. PII のための CSR は許すが、Client Island は最小にする

PII を扱う箇所は、必要であれば CSR 化してよい。**PII のために SSR / PPR を諦めることは許可する。** 機密性が性能に優先する(不変条件 1)以上、これは妥協ではなく既定の順序である。

**ただし、そのために画面全体を CSR へ落とすことは禁じる。** PII を必要とする範囲だけを最小の Client Island として切り出す。

```text
Page
├─ Static / Server content
├─ public data
├─ UserMenu ← CSR / user-scoped（ここだけ）
└─ public data
```

**CSR は PII を安全にする手段ではない。** ブラウザへ PII が届くことに変わりはないため、CSR を選んだ場合も次を守る。

- 必要な属性だけを取得する(決定 9)
- client state への保持を最小にする
- `localStorage` / `sessionStorage` 等へ不必要に永続化しない
- analytics / telemetry / log / error report へ載せない([0081](0081-observability-logging.md) / [0082](0082-client-observability.md) の redaction が正)
- Client DTO を最小にし、server object をそのまま渡さない(不変条件 5)

### 9. 取得・保持・送信のすべてを最小化する

境界の置き方だけでなく、**取得するデータそのものを最小化する**。

- ❌ User API から User 全体を取得し、client では名前しか使わない
- ✅ 必要な属性を特定 → 必要最小限の DTO / endpoint / projection → その範囲だけを使う

**取得する PII も、保持する PII も、送信する PII も最小化する。** 契約が過剰な形しか返さない場合、詰め替えは取得の口([0072](0072-api-type-generation.md) の変換境界)で行い、内層へは最小化した形だけを渡す。

### 10. 判断の順序

PII を含む画面 / component は、次の順で決める。**最初から CSR を選ばず、最小の露出範囲を探す。**

```text
1. 本当にその PII が必要か
2. 必要な属性を最小化する
3. server / request-scoped で安全に扱えるか
4. 共有・静的キャッシュを避ける
5. PPR の dynamic hole に閉じ込められるか
6. 必要なら最小範囲だけ CSR にする
7. Client DTO を最小化する
8. taint 等の runtime guard を適用する
```

## 禁止事項

- ❌ user-scoped な取得に `cache` / `tags` を渡すこと(決定 1 / 3)
- ❌ user-scoped な値を、サーバ側に保存されるキャッシュ(Data Cache / `use cache` / `unstable_cache`)へ入れること。手段は `use cache: private` に限る(決定 3)
- ❌ 資格情報を `cookies()` 以外の経路(モジュール変数・引数での持ち回り・境界をまたぐメモ化)で解決すること(決定 5。cookie が存在しない session 確立の 1 往復だけが例外で、そこは `bearerToken` の綴りで渡す)
- ❌ 分類をラッパ型で表現し、feature 層に unwrap を配ること(決定 1)
- ❌ どれか 1 つの段で全部を守れると見なして他の段を省くこと(決定 4)
- ❌ React Compiler を PII / キャッシュ境界の防御として数えること(決定 6)
- ❌ **PII を含むという理由で画面全体を CSR 化すること**(決定 8。切り出すのは最小の Client Island)
- ❌ **SSR-First を理由に PII を SSR / PPR で処理すること**(不変条件 1 / 6)
- ❌ **キャッシュヒット率の向上を理由に user-scoped データを共有キャッシュへ入れること**(不変条件 1 / 2)
- ❌ **client で一部しか使わないのに User オブジェクト全体を送ること**(決定 9)
- ❌ **public data と PII を同じキャッシュ可能な DTO へ混在させること**(混ざった時点で全体が user-scoped になる)
- ❌ **性能改善を理由に PII 境界を緩めること**(不変条件 6)

## 補足

- **[0020](0020-adopted-architecture.md) 設計原則 6 との関係**: 原則 6 は「他の層が握る問題を、こちらで予防的に手当てしない」と定める。本 ADR の段はこれに反しない —— **それぞれが自分の持ち場を守っている**のであって、他所の答えを二つ目に書いているのではない。ただし決定 5 の前提に段 3 と取得時の関門が二重に乗る点だけは重複であり、これは同原則の**セキュリティ例外**(責務分界は防御を薄くする理由にならない)を根拠とする。
- **実装時に実測する点**: `verifySession` は React `cache()` でメモ化されている。cached scope の外で解決済みの値が中で再利用されると、`cookies()` が再読されず段 3 が発火しない可能性がある。有効化時に実測して確かめる。
- **トレードオフ**: 通常実装の可読性はほぼ変わらない(feature 側の記述は増えず、変わるのは adapter を書くときに口を選ぶ 1 行)。代わりに、資格情報を載せうる口は共有キャッシュの選択肢を失う。「匿名でも取れるものを共有キャッシュへ」という最適化を採るなら、**口を分ける**ことが条件になる。

- **SSR-First との関係**: [0040](0040-routing-rendering-strategy.md) は Server Components を既定とし、どのレンダリングモードも閉ざさないと定める。これは**性能と UX 上の既定値**であって、PII の機密性を上回る制約ではない。既定は維持しつつ、PII を含む範囲では不変条件 1 が優先し、決定 8 / 10 の順序で決める。
- **PPR との関係**: [0041](0041-cache-components-decision.md) の PPR は **public data に対する性能最適化**として扱う。user-scoped な値については、共有・静的キャッシュの恩恵より機密性を優先する。

## 関連 ADR

- [0020-adopted-architecture.md](0020-adopted-architecture.md) — 設計原則 6(責務を超えた予防措置 / セキュリティ例外)
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — §8 漏洩防御(`server-only` + taint)。本 ADR の段 4
- [0041-cache-components-decision.md](0041-cache-components-decision.md) — Cache Components(PPR)。本 ADR は有効化の前提
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — キャッシュ・再検証の所有層。`docs/rules.md` #79b の Rationale
- [0072-api-type-generation.md](0072-api-type-generation.md) — 型漏洩禁止(wire 型を内層へ出さない)
- [0029-type-design-discipline.md](0029-type-design-discipline.md) — branded / opaque(secret の値型)
- [0111-csp-security-headers.md](0111-csp-security-headers.md) — 応答ヘッダ。本 ADR の段 5
- [0110-security-operations.md](0110-security-operations.md) — セキュリティ運用の全体像
- [0042-react19-rendering-api.md](0042-react19-rendering-api.md) — React Compiler は性能最適化のみ(本 ADR の対象外)

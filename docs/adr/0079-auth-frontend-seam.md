# 認証のフロント側 seam

**認証本体(IdP・ユーザDB・資格情報検証・トークン発行・session の永続実装)は本 boilerplate の out of scope である**([0070](0070-backend-role-separation.md))。この宣言を前提に本 ADR は、テンプレートから作った側がどの認証プロバイダを選んでも変わらない **フロント側の seam(接続点)の形** のみを定める。すなわち session の保管場所規約 / 認可 2 層(optimistic + 確定認可)の分担 / 保護ルートの表現 / 未認証時リダイレクトと `returnUrl` / ログアウト時の状態破棄を、[0021](0021-frontend-responsibility.md) のカーネル上の座標として確定する。seam の形は発明せず、**Next.js 公式 auth ガイドの文書化パターンに乗る**([0010](0010-standards-and-non-lockin.md) §1)。

## Status

Accepted

## 背景

認証は out of scope でありながら、**seam なしでは保護ページが 1 枚も書けない**という点で、out-of-scope 領域の中で最も「seam の欠落」が濃い。関連する断片は複数 ADR に散っている:

- [0070](0070-backend-role-separation.md) — 「認証・セッションの具体モデルは作った側の判断」「thin proxy / token 交換の seam は許す」「確定的な認可はデータ境界」
- [0043](0043-middleware-policy.md) — 「`proxy.ts` は optimistic チェックのみ / 確定認可はデータ境界 / Node.js runtime / 唯一の防御線にしない」
- [0021](0021-frontend-responsibility.md) — `adapters/server`(secret 可・`server-only`)/ `model`(表示用 VO)/ app の thin 原則
- [0040](0040-routing-rendering-strategy.md) — Server Component 既定 / `"use client"` を葉へ / Server Action は編成のみ

これらは各 ADR の関心の副産物として断片化しており、「保護ページをどう書くか」を問う読み手は 4 本を横断せねばならず **局所推論が崩れている**。本 ADR はこの断片を **Next.js 文書化パターン**として 1 本に束ね、認証 seam の推論起点を一本化する。

**裏取り元**: `node_modules/next/dist/docs/01-app/02-guides/authentication.md`(実装前確認。「This is NOT the Next.js you know」— Next.js 16)。同ガイドの Authorization 節は (1) httpOnly session cookie に最小 payload を格納、(2) 認可を 2 層(optimistic checks with Proxy〈optional〉+ Data Access Layer の `verifySession()` を React `cache()` で memo 化した確定認可)、(3) DTO で必要データのみ返す、を推奨形として文書化している。

**0070 の中立との整合**: 0070 が守る中立は **プロバイダ中立**であって **seam の形の中立ではない**。Next.js 自身が httpOnly cookie を標準推奨している以上、それに乗るのは特定方式の先取りではなく **プラットフォーム標準準拠**([0010](0010-standards-and-non-lockin.md) §1)であり、0070 の「特定の認証・セッションモデルを本体に前提として組み込まない」とは衝突しない。本 ADR が固定するのは seam の形(座標)のみで、プロバイダ・session 実装詳細(stateless vs DB / 暗号化方式)は作った側に委ねる。

## 決定

### 1. session の保管 = httpOnly cookie / payload 最小

- session の保管場所の seam は **httpOnly cookie**(Next.js `cookies()` API)とする。cookie は **server で set** し、`httpOnly` / `Secure` / `SameSite` / `Max-Age`(or `Expires`)/ `Path` を既定属性とする(具体既定値・アプリ cookie 規約は `docs/rules.md`「データ分類と機微情報」の「アプリ cookie は用途を接頭辞に含め、属性を用途ごとに明示する」が保持)。
- **payload は最小**(id / role 等の後続リクエストで使う一意データのみ)。PII(電話番号・メール・カード情報)や機微情報(パスワード)を **cookie に入れない**。
- **vendor-independent 正当性材料**(0010 §2 必須):
  - **httpOnly = XSS によるトークン窃取の緩和** — client-side JS から cookie を読めなくすることで、XSS 起点の session 窃取という web 一般の攻撃面を塞ぐ。これは Next.js 固有の話でなく MDN / OWASP 由来の web セキュリティ基本原理である。
  - **最小 payload = 最小権限(least privilege)/ 最小データ露出** — cookie は各リクエストで送出され改竄面でもあるため、載せる情報を必要最小に絞ることは attack surface と情報漏洩を減らす一般原則である。
- session 実装詳細(stateless JWT 風 vs DB session id / 暗号化・署名方式)は **作った側の判断**([0070](0070-backend-role-separation.md))。boilerplate 本体は特定方式を組み込まない。

### 2. 認可は 2 層(optimistic + 確定)/ 確定認可はデータ源に最も近い所

Next.js 文書化パターンに乗り、認可を **2 層**に分ける:

- **optimistic(楽観)層 = `proxy.ts`**(optional・[0043](0043-middleware-policy.md))— cookie の session のみを読み、権限ベースの **リダイレクト / UI 出し分け**に使う。**DB / データ源参照は禁止**(Proxy は prefetch 含む全 route で走るため。cookie 読みは `req.cookies.get(...)` に留める)。**唯一の防御線にしない**。Node.js runtime([0043](0043-middleware-policy.md))。
- **確定認可層 = Data Access Layer(DAL)**— session を検証する `verifySession()` を **`adapters/server`**([0021](0021-frontend-responsibility.md) / [0024](0024-adapters-server-client-split.md))に置き、**React `cache()` で 1 render pass 内を memo 化**する。app 層の入口(route-segment / Route Handler / Server Action)は必ずこの `verifySession()` を通してから feature へ進む。「security checks はデータ源に最も近い所で行う」= **確定認可の本丸はデータ境界**([0070](0070-backend-role-separation.md) / [0043](0043-middleware-policy.md) と一貫)。
- **カーネル座標の導出**(べき論): `verifySession()` は session cookie(`server-only`)と secret を扱う **remote/runtime 境界 = `adapters/server`** に属する(secret を持てる唯一の実行層 = `adapters/server`。[0021](0021-frontend-responsibility.md) 依存マトリクス / [0024](0024-adapters-server-client-split.md))。DAL を `adapters/server` に置くことで「session verify は境界アダプタが所有し、内側の層(`model` / feature 純粋ロジック)は session を知らない」が保たれる(型漏洩禁止・[0020](0020-adopted-architecture.md))。
- **vendor-independent 正当性材料**(0010 §2 必須):
  - **データ境界での確定認可 = 多層防御(defense in depth)** — Proxy(edge/入口)の楽観チェックは最適化配置(CDN)や prefetch の都合で信頼の単一点にできないため、検査を **データ源直近**に置いて最終防御線とする。これは「認可はリソースアクセス直前に行う」という web セキュリティ一般原則であり、Next.js を正当化から抜いても成立する(0010 運用テスト: Yes)。

### 3. DTO / 露出データの最小化

- session / user データを内側(Client Component / view)へ渡す際は、**DTO で必要フィールドのみを返す**。user オブジェクト全体(パスワード・電話番号等を含み得る)を渡さない。
- **カーネル座標**: DTO の形(公開してよい view 用の型)は **`model`**(表示用 VO / view 型)が所有し、DTO への変換(shaping・可視性判定)は所有境界 = **`adapters/server`** で行う(生成型・外部型を内層へ漏らさない変換の所有境界。[0070](0070-backend-role-separation.md) 境界値所有 / [0020](0020-adopted-architecture.md))。
- **vendor-independent 正当性材料**: **DTO = 最小権限 / 最小露出** — client に渡るのは「表示に必要な安全なフィールド」に限定され、over-fetch した機微データの client 漏洩を構造的に防ぐ。これも web 一般原則で Next.js 非依存。

### 4. 保護ルートの表現 / チェックの各所配置

- 保護は **入口ごとにチェック**する(`layout.tsx` / `page.tsx` / `route.ts` / `actions.ts`)。`proxy.ts` の optimistic リダイレクトは入口の pre-filter に過ぎず、app 層の各入口で `verifySession()`(DAL)か、`adapters` が分類した結果を通すことを既定とする。Server Action は route を経由せずに呼べる独立した入口なので、画面が保護されていることを理由に断言を省かない([0021](0021-frontend-responsibility.md)「Server Action の置き場」)。
- **session に基づく保護の編成は app 層が行う。** `verifySession()` を呼び、結果で分岐し、リダイレクトするか feature を呼ぶ —— これは driving adapter の合成であって業務ロジックではない([0040](0040-routing-rendering-strategy.md) / [0021](0021-frontend-responsibility.md))。`features` がこれを持てないのは、DAL を含む `adapters/server/auth` へ触れてよいのが `app` と `adapters` だけだからで(`architecture.ts` の `adapters-auth`)、依存マトリクスの帰結であって例外規定ではない([0021](0021-frontend-responsibility.md))。
- **feature が受け取ってよいのは `adapters` が分類した結果であって、session そのものではない。** 「未認証 / 未登録 / 登録済み」のような列挙は表示用の値であり、session の型も secret も内側の層へ渡らない([0020](0020-adopted-architecture.md) 型漏洩禁止)。この形なら入口ガードを feature に 1 つ置いて、同じ判定を画面ごとに書き写さずに済む。**分類を作るのは `adapters` の仕事**であり、feature のために session を素通しする関数を `adapters` へ足してはならない —— それは依存マトリクスを迂回して session の分岐を feature へ持ち込む経路になる。判定に使う規則そのものはバックエンドが持つ([0070](0070-backend-role-separation.md))。
- **判定の述語は `model` が持つ。** 「この session が役割を満たすか」は session を入力に取る純粋な判定であり、app 層にも feature にも書かない。前捌き(`proxy.ts`)と確定認可が同じ述語を引くことで、2 層の判定がずれない。
- **保護は保護される側を列挙して宣言する。** 公開側を列挙する書き方だと、新しく足した画面が既定で公開になり、書き忘れがそのまま漏洩になる。**経路の接頭辞は入れ子にしない** —— 入れ子を許すと、どちらの宣言が勝つかを決める規則が要り、宣言の並べ替えだけで認可が変わる状態を作れる。1 つの経路に 2 通りの役割を求めたくなったときは、規則を足す前にその設計を見直す。経路の一覧そのものはコード(`src/model/authz.ts`)が持つ
- **静的ルートの注意**: build 時に取得され全ユーザで共有される静的 route は DAL(request 時検証)が効かないため、その保護は `proxy.ts`(optimistic)側で行う(Next.js ガイド注記)。

### 5. 未認証リダイレクト / `returnUrl` / ログアウト時の状態破棄

- 未認証時のリダイレクト先(サインイン route)と復帰用 `returnUrl`(元 URL の保持・検証)の規約は seam として名前を付けて残す。**open redirect を避けるため `returnUrl` は同一 origin の相対パスに限定検証する**(web 一般の入力検証)。
- ログアウトは **session cookie の破棄(server)+ client 側の派生状態・キャッシュの teardown** を伴う。破棄の起点は `adapters/server`(cookie 削除)に置く。
- **利用者のブラウザが IdP の session を持っている場合は、加えてブラウザを IdP の終了口へ遷移させる。** IdP 側の session を保持しているのは利用者のブラウザが持つ cookie であり、サーバから発した要求にそれは載らない —— 要求は成功を返しながら、IdP 側は何も終わらない。**この機構をここが持つ**ので、実装側は繰り返さずに本節を指す(呼び出しの連鎖に沿って同じ根拠が何度も書かれることになるため)。
- **遷移が要るかどうかは、ログインが借り物の画面を経由したかで決まる。** 所有画面から資格情報を渡した経路(§6)では、ブラウザは IdP を一度も訪れておらず、破棄すべき IdP 側 cookie が存在しない。federation の経路(§6)だけがブラウザに IdP の session を残すため、終了口への遷移もその経路に限る。**どちらで確立したかは session 側が保持する** —— ログアウト時に推測すると、破棄漏れか無駄な往復のどちらかが必ず出る。
- **client 側の取得が資格情報切れ(401)を受けたときは、その取得の失敗として扱わず、サーバへ描き直しを頼む。** 続きを読めなかった失敗として画面に出すと、利用者にできるのは読み直しだけで、サインインへ導く経路が無い。描き直せば各入口の判定(§4)が走り、未認証のリダイレクトへ倒れる([0080](0080-error-handling.md) §2 の「`Unauthenticated` を `Internal` へ畳まない」が前提)。
- サインイン UI・session 更新(refresh)の具体は §6 の Resolver に閉じる。本 ADR は座標(どの層が何を所有するか)と拡張点の名前を敷く。

### 6. 動く最小 session 機構を本体へ同梱する(Resolver IF 方式)

**IF 定義だけを置いて実装を作った側に丸投げしない。** 使われない IF は腐り、実装時に必ず書き直されるため、**既定実装を 1 つ同梱して実際に動かす**。禁止事項の「特定の session 実装詳細を本体に前提として組み込まない」は、次の切り分けで満たす。

- **コアに残すもの(作った側が書き直さない部分)** — seam の座標 / 保護ルート判定 / `returnUrl` の検証 / ログアウト時の状態破棄 / RBAC ヘルパ / `verifySession()` の呼び出し規約
- **Resolver の裏に隠すもの(各社の事情が入る部分)** — session の暗号化・署名方式 / バックエンドの認証エンドポイントの叩き方 / federation の開始と復帰 / トークンの保管形式。これらは **Resolver IF** の内部処理とし、作った側は Resolver を差し替えるだけで自社方式へ移行できる
- **既定実装を 1 つ同梱する**。サンプルが実際にこの既定 Resolver を使う(= 設置面が実在する)ため、空の IF 定義にはならない
- 認証フローは **所有画面 + バックエンド仲介**とする。資格情報とチャレンジ応答は所有画面が受け取り、**Route Handler(`/api/auth/*`)がバックエンドへ中継する**。**IdP の API をこのリポジトリから直接叩かない** —— IdP 固有 SDK も IdP の資格情報もこのリポジトリの依存に入らない。ブラウザが持つのは httpOnly の BFF session cookie のみで、**Access Token をブラウザへ露出しない**
- **バックエンドが返すチャレンジは正規化された形とする。** 追加入力が要るとき、バックエンドは「どの種類の入力が要るか」を中立の列挙で返し、このリポジトリは種類から画面を選ぶ。IdP 固有のチャレンジ名・継続用の文字列・エラーコードを画面と `features` へ持ち込まない([0070](0070-backend-role-separation.md) / [0020](0020-adopted-architecture.md) 型漏洩禁止)。**この正規化が無いと、IdP の語彙が画面まで到達する** —— 認証の本流が特定プロバイダへ結合し、差し替え可能性(0010)が Resolver の外で壊れる
- **federation(ソーシャル / 企業 IdP 連携)だけは借り物の画面へ遷移する。** 連携先での認可は利用者のブラウザの遷移でしか成立せず、サーバ間 API では代替できない。この経路の意匠は §8 の供給が扱う
- 認証が要る API 呼び出しは、**BFF 経由で Bearer が自動付与される前提**で実装する(個別に Authorization ヘッダを組み立てない)
- **401 = 未ログイン / セッション切れ → サインインへ**、**403 = 権限不足 → 導線ごと出し分け**([0080](0080-error-handling.md) の分類に対応させる)
- Resolver の IF 形状 / 既定実装のライブラリ選定 / refresh の扱いは本 ADR では定めず、既定 Resolver(`src/adapters/server/auth/session-resolver.ts`)が持つ
- **role の取得元はバックエンドとする。** IdP が持つのは身元（誰であるか）で、何をしてよいかは業務側のデータである([0070](0070-backend-role-separation.md))。ID Token の claim から読むと、IdP を差し替えるたびに役割の出所が変わり、IdP 側に業務の役割体系を持たせる圧力が生まれる。既定 Resolver は取得口を依存として受け取り、session を確立する途中で 1 度だけ引く。役割が 1 つも無い主体は権限を持たない側へ倒す。**本体が敷く役割の集合は「特権を持つ側」と「持たない側」の 2 つだけ**とする —— 実際の役割体系はバックエンドが所有するため、本体が持つのは機構を動かして確かめられる最小の集合であり、作った側はこれを自分の体系へ置き換える

### 7. 未認証時の状態を、ログイン成立の時点で引き継ぐ

未認証のまま操作を始められる機能は、ログイン成立の時点でその状態を認証済みの主体へ**引き継ぐ**必要がある。§5 がログアウト時の破棄を扱うのに対し、本節は逆向きの接続点を敷く。

- **引き継ぎ元の識別子は httpOnly cookie に置き、BFF が持つ**。ブラウザへ露出させない理由は §1 の session と同じ(XSS 起点の窃取の緩和)。**session cookie とは別の cookie** にする — 未認証でも発行され、寿命も主体も session と一致しないため、session payload へ混ぜると §1 の「payload は最小」に反する。用途接頭辞と `Secure` / `HttpOnly` / `SameSite` / `Max-Age` の明示は `docs/rules.md`「データ分類と機微情報」の「アプリ cookie は用途を接頭辞に含め、属性を用途ごとに明示する」に従う。
- **引き継ぎを起こすのは `/api/auth/*` の callback ただ 1 箇所**。未認証時の識別子と確立直後の session が同時に手元にあるのはここだけで、1 回の認証往復につき 1 回だけ走る。`proxy.ts` は不可(§2 / [0043](0043-middleware-policy.md) — optimistic 層に副作用を置かない)。画面側からも呼ばない(ブラウザは Access Token を持たない。§6)。
- **引き継ぎの失敗でログインを失敗させない**。ログインの成否は認証の成否で決まる。引き継ぎは付随する処理であり、失敗はログに残して利用者にはログイン成功として見せる。
- **引き継ぎの規則はバックエンドが持つ**([0070](0070-backend-role-separation.md))。合算・上限・優先といった判断は業務ロジックであり、BFF は起点を与えるだけで規則を実装しない。
- **引き継ぎの結果は BFF が受け取れる形にする**。切り捨てや丸めなど利用者へ知らせるべき結果が生じうる場合、バックエンド内部の認証完了フックに寄せると報告先が無くなる。表示するかどうかは画面の判断に残す。
- **引き継ぎ後、元の識別子の cookie は破棄する**。引き継ぎ済みの識別子が残ると、二重適用の経路になり、引き継ぎ先が他者の主体である場合には到達経路にもなる。ログアウト時の teardown(§5)にも含める。

**vendor-independent 正当性材料**([0010](0010-standards-and-non-lockin.md) §2): 引き継ぎを認証往復の**片側 1 箇所**に閉じるのは、同じ状態遷移を複数の起点から起こすと二重適用と競合の面が増えるという一般原則(単一の書き込み経路)による。失敗でログインを落とさないのは、**関心の分離** — 認証の可否を、認証と無関係な処理の成否に従属させないこと。

### 8. 資格情報を検証しない / 認証画面は意匠ごと所有する

**入力面の所有と、検証機構の所有は別の話であり、畳むと必ず片方を落とす。** 「検証が向こうだから
画面も向こうのもの」も、「画面がこちらだから検証もこちらでよい」も、同じ畳み方の裏表である。
本 ADR が禁じているのは**このリポジトリが資格情報を検証・保持すること**であって、入力を受け取る
画面を持つことではない。

#### 用語

| 呼び名 | 意味 |
| --- | --- |
| **所有画面** | このリポジトリが実装し、配信する画面。`/login` / `/onboarding` など |
| **借り物の画面** | IdP が実装し、IdP が配信する画面。サインイン・MFA・パスワード再設定など |

本 ADR で **`面` は接続点(差し替え境界)の意味**で使い、画面の意味では使わない。同じ語を両方に
使うと、`session-resolver.ts` の「この面の内側」が画面の話に読める。

#### 所有の線

| | 入力面 | 検証機構 | 意匠 |
| --- | --- | --- | --- |
| `/login`・チャレンジ画面(所有画面) | **所有** | **持たない(中継のみ)** | 所有 |
| federation の連携先(借り物) | 借り物 | 借り物 | **所有(供給する)** |
| IdP の終了口(借り物) | — | 借り物 | **所有(供給する)** |
| `/onboarding`(所有画面) | 所有 | — | 所有 |

**主たる経路に借り物の画面は現れない。** `/login`(所有)→ 必要ならチャレンジ画面(所有)→
`/onboarding`(所有)で、利用者は最後まで自分のドメインを離れない。借り物の画面が現れるのは
federation の連携先と IdP の終了口だけであり、そこには意匠を供給する(§6 / §5)。

- **資格情報の入力面は所有する。** ID / パスワード / MFA コードの入力欄を所有画面へ置く。利用者から
  見た認証は、遷移の途中で見知らぬドメインへ着地しない 1 本の導線になる
- **入力面だけを持つ部品は、本 ADR の射程に入らない。** 桁を分割したコード入力欄のような部品は、名前に
  「OTP」と付いていても値の種類を指しているだけで、発行・照合・有効期限・試行回数の制限といった検証の
  責務を持たない。`Input` にパスワードを入れても `Input` が認証責務を持たないのと同じで、認証と無関係な
  確認コード(メールアドレスの確認・機微操作の step-up)にも使う。名前から認証部品と読んで置き場を誤らない
- **このリポジトリは資格情報を検証しない。** できるのは**バックエンドへの中継だけ**である。受け取った
  資格情報を保存しない / ログへ出さない / session payload へ載せない(§1)/ 中継以外の判断へ使わない。
  正しさの判定・試行回数の制限・ロックアウトはすべてバックエンドが持つ([0070](0070-backend-role-separation.md))
- **IdP の API を直接叩かない。** IdP 固有 SDK をこのリポジトリの依存に入れず、IdP の資格情報も持たない。
  叩けば、認証の本流がその IdP へ結合し、Resolver の外で差し替え可能性が壊れる(§6 / [0010](0010-standards-and-non-lockin.md))。
  **IdP の選択に依存しない恒久の線**はここに引く —— 入力欄の有無ではなく、**IdP を知っているかどうか**が線である
- **認証画面の意匠は所有する。** 所有画面は design token が直接効く。借り物なのは federation の連携先と
  終了口だけなので、そこへは IdP のブランディング機構を通して token から供給する。**手で二重管理しない**
  —— 色や書体を IdP の管理画面へ書き写すと、token を動かしてもその画面だけが古い姿で残る
- **供給できる範囲は IdP のブランディング機構が決める。** 供給しきれない部分が残ることは、意匠を
  所有しないことを意味しない —— 供給できる範囲を供給し、できない範囲を分かって残すのと、何も
  供給しないのは別である

**vendor-independent 正当性材料**([0010](0010-standards-and-non-lockin.md) §2): 中継に留めて検証も
保持もしないのは、**扱わないデータは漏らせない**という一般原則(最小露出)による。通過するだけの値に
対して責任範囲が広がるのは、保存・ログ・派生を始めた時点である。IdP を知らないままにするのは、
**依存は差し替えられる形で持つ**という一般原則であり、IdP を替えてもこの線は動かない。意匠を供給元
1 つに寄せるのは、同じ値を 2 箇所で持つと必ず片方がずれるという、この repo が token の SSOT でも
採っている一般原則である。

## 禁止事項

- ❌ 認証 seam の形を独自発明・中立化すること(Next.js 文書化パターン = httpOnly cookie / optimistic + DAL / DTO に乗る。[0010](0010-standards-and-non-lockin.md) §1)
- ❌ 本 ADR の決定を「Next.js が推奨するから」だけで正当化すること(vendor-independent 材料 = httpOnly:XSS 緩和 / データ境界:多層防御 / DTO・最小 payload:最小権限 を本体に添える。[0010](0010-standards-and-non-lockin.md) §2)
- ❌ 特定の認証プロバイダ・IdP・session 実装詳細(暗号化方式 / stateless vs DB)を **Resolver の外**へ組み込むこと(§6。既定実装は Resolver の裏に閉じ、差し替え可能に保つ。[0070](0070-backend-role-separation.md))
- ❌ Access Token をブラウザ(client JS / localStorage / 非 httpOnly cookie)へ露出させること(§6)
- ❌ 設置面のない空の IF / port 定義だけを置いて実装を持たないこと(§6)
- ❌ 受け取った資格情報を保存・ログ出力・session payload へ載せること / 中継以外の判断へ使うこと(§8)
- ❌ 資格情報の正しさの判定・試行回数の制限・ロックアウトをこのリポジトリで実装すること(バックエンドが持つ。§8 / [0070](0070-backend-role-separation.md))
- ❌ IdP の API を直接叩くこと / IdP 固有 SDK・IdP の資格情報をこのリポジトリの依存に入れること(§6 / §8)
- ❌ IdP 固有のチャレンジ名・継続用の文字列・エラーコードを画面や `features` へ持ち込むこと(バックエンドが正規化した列挙のみを受け取る。§6)
- ❌ 借り物の画面の意匠を放棄すること / ブランディングの設定を design token と別に手で持つこと(§8)
- ❌ `面` を画面の意味で使うこと(接続点の意味で予約済み。§8 の用語)
- ❌ `proxy.ts` を確定認可の主機構・唯一の防御線にすること / Proxy 内で DB・データ源を参照すること(optimistic・cookie 読みのみ。[0043](0043-middleware-policy.md))
- ❌ 確定認可(`verifySession()` / DAL)を `adapters/server` 以外に置くこと / session・secret を内側の層(`model` / feature 純粋ロジック / client)へ漏らすこと([0021](0021-frontend-responsibility.md) / [0024](0024-adapters-server-client-split.md) / [0020](0020-adopted-architecture.md))
- ❌ cookie payload に PII・機微情報を載せること / user オブジェクト全体を DTO なしで client へ渡すこと
- ❌ 認可の**判定規則**(どの役割が何を満たすか)を app 層 / `features` / `proxy.ts` へ直書きすること(述語は `model`。app が持つのは編成のみ。§4)
- ❌ `features` から `adapters/server/auth`(DAL / session)を import すること / session の型を `features` へ渡すこと(依存マトリクスの帰結と型漏洩禁止。[0021](0021-frontend-responsibility.md) / [0020](0020-adopted-architecture.md) / `architecture.ts` の `adapters-auth`)
- ❌ `returnUrl` を検証せず外部 URL へリダイレクトすること(open redirect。同一 origin 相対パスに限定)
- ❌ 未認証時の識別子をブラウザから読める形(localStorage / 非 httpOnly cookie)で持つこと / session cookie の payload へ混ぜること(§7)
- ❌ 引き継ぎを callback 以外(`proxy.ts` / 画面 / 複数の起点)から起こすこと / 引き継ぎの失敗でログインを失敗させること(§7)
- ❌ 引き継ぎの規則(合算・上限・優先)をフロントに実装すること(業務ロジックはバックエンド。§7 / [0070](0070-backend-role-separation.md))

## 補足

- 本 ADR は **seam の座標(どの層が session verify / DTO / cookie を所有するか)** に加えて、**動く最小 session 機構の同梱**(§6 Resolver IF + 既定実装 1 本)を確定する。boilerplate 本体が持つのは既定実装であって「唯一の実装」ではない。
- **CSRF / origin 検証は本 ADR に同居させない。** それは日常強制される rule であり、`docs/rules.md`「認可と入口」の「状態を変える要求の送信元を検証する」が持つ。本 ADR の httpOnly / SameSite cookie 前提がその rule の土台を提供する関係のみを明記する([0140](0140-documentation-operations.md) 「decision と rule を分ける」タクソノミー)。
- **CSP / セキュリティヘッダ([0111](0111-csp-security-headers.md))との境界**: 認証 seam(本 ADR)と CSP 実行時本体は別関心。cookie 属性・認可分担は本 ADR、`Content-Security-Policy` / `X-Frame-Options` 等のヘッダ配置は 0111 が所有する。両者を同居させない(局所推論の維持)。
- 本 ADR は [0140](0140-documentation-operations.md) タクソノミーにおいて **decision**(seam 定義)分類に属する。日常強制される rule(cookie 属性既定値 = 「データ分類と機微情報」の「アプリ cookie は用途を接頭辞に含め、属性を用途ごとに明示する」/ CSRF = 「認可と入口」の「状態を変える要求の送信元を検証する」)は `docs/rules.md` 側が持つ。

## 関連 ADR

- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠(§1 seam はデファクトに乗る)/ 非ロックイン判定(§2 vendor-independent 正当性材料の必須化)。本 ADR の 2 原則の土台
- [0070-backend-role-separation.md](0070-backend-role-separation.md) — 認証は out of scope / thin proxy・token 交換の seam / 確定認可はデータ境界(プロバイダ中立の意味 = 本 ADR の前提)
- [0043-middleware-policy.md](0043-middleware-policy.md) — `proxy.ts` = optimistic のみ / Node.js runtime / 唯一の防御線にしない(認可 optimistic 層の所有)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `adapters/server`(DAL / secret / `server-only`)/ `model`(DTO view 型)/ app の thin 原則(カーネル座標の SSOT)
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md) — `adapters/server`(secret 可)vs `adapters/client`(secret 不可)。DAL が server 面に属する根拠
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — Server Component 既定 / `page.tsx` thin / Server Action 編成のみ(各所チェックの配置根拠)
- [0020-adopted-architecture.md](0020-adopted-architecture.md) — 型漏洩禁止(session・secret を内層へ漏らさない)
- [0111-csp-security-headers.md](0111-csp-security-headers.md) — CSP / セキュリティヘッダ(本 ADR と同居させない別関心)
- [0080-error-handling.md](0080-error-handling.md) — 401 / 403 の分類(§5 / §6 が対応させる先)
- [0140-documentation-operations.md](0140-documentation-operations.md) — decision / rule タクソノミー(cookie 属性は `docs/rules.md`「データ分類と機微情報」・CSRF は「認可と入口」の側)

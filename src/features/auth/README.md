---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 相手の facade/ と、画面まるごとの story は例外
test-requirement: feature
---

# auth

ログインの画面スライスです。持つのは「認証を始める」導線だけです。

## 受け入れるもの

- 認証を始める操作と、そこへ至った理由（未認証で弾かれた、ログアウト直後、始められずに戻された）の提示
- 認証と登録の境界の説明。どの IdP を繋いでも真である範囲だけを書き、名前や環境ごとの案内は入れません
- 認証後に戻る先の受け渡し

## 受け入れないもの

- 認証そのもの（IdP との往復、トークンの交換、session の作成）。すべて `/api/auth/*` の
  Route Handler と `adapters/server/auth` が持ちます
- メールアドレスとパスワードの入力欄。資格情報は IdP の画面が受け取るもので、この画面を通りません
- session の読み取り（画面は認証済みかどうかを知らない。判定は `verifySession()` と `proxy.ts`）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/login` | [`screen`](../../../docs/spec/route/auth/login/page.screen.md) / [`function`](../../../docs/spec/route/auth/login/page.function.md) | 不要（ここが入口） |

外枠の約束は [`auth` の layout](../../../docs/spec/route/auth/layout.screen.md) が持ちます。

**operationId は使いません。** この画面が呼ぶのは同一オリジンの `/api/auth/login` だけで、IdP と
やり取りするのは Route Handler です。どの IdP を繋いでも画面が変わらないのは、契約をここへ
持ち込んでいないためです。

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| ログイン | 直接来た | `Features/Auth/LoginView/Default` |
| | 保護ルートで弾かれた（戻り先つき） | `Features/Auth/LoginView/WithReturnUrl` |
| | 認証を始められなかった | `Features/Auth/LoginView/Unavailable` |

loading / empty / error の 3 つは持ちません。**取得が無いためです** —— 画面が出るのは case が
確定した後で、待つものも、空になるものもありません。

## 構成

画面が 1 つしかないため、画面を挟まず直下へ置きます。

| モジュール | 役割 |
| --- | --- |
| `login-view.tsx` | ログイン画面。認証を始める form と、始められなかったときの案内 |
| `read-login-notice.ts` | URL から案内する理由を読む（読む側） |
| `facade/paths.ts` | 他の feature が指すための、この画面への行き先 |
| `facade/login-notice.ts` | 案内の語彙と、始められなかったときの行き先（組む側）。**行き先を組むのは Route Handler**（`app/api/auth/login`）で、Route Handler が引けるのは feature の `facade/` だけ |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `model` | 戻り先の安全な形（`return-url`）と、案内する理由の語彙 |
| `components` | 面を組む器（カード・ボタン・案内） |

**`adapters` を引きません。** 認証の往復を持たないためで、これがこの slice の線引きそのものです。

## Action 戻り値契約

なし。認証の開始は Server Action ではなく、`/api/auth/login` への素の form 送信です。**Server
Action の `redirect()` は Route Handler へ遷移できません** —— client router が飲み込み、要求が
出ないまま URL だけが書き換わります。

## テスト観点

- [ ] 戻り先が安全な形へ均されてから form に載る（外部の URL が素通りしない）
- [ ] 案内の理由ごとに文言が変わり、理由が無いときは何も出ない
- [ ] 資格情報の入力欄が画面に現れない

## 隣に置くもの

- 保護ルートの判定と未認証時のリダイレクトは [`src/proxy.ts`](../../proxy.ts)
- 認証の往復は [`src/app/api/auth/`](../../app/api/auth)
- 確定認可は [`adapters/server/auth`](../../adapters/server/auth)

## 関連する ADR

- [0021](../../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。他 feature へ貸すものを `facade/` に出す
- [0025](../../../docs/adr/0025-app-layer-elements.md) — app 層の構成要素。Route Handler が引ける先は feature の `facade/` まで
- [0027](../../../docs/adr/0027-directory-structure.md) — 物理配置と co-location。画面が 1 つなら画面ディレクトリを挟まない
- [0043](../../../docs/adr/0043-middleware-policy.md) — 入口（proxy）の役割。保護ルートの判定と未認証時の送り先はそちらが持つ
- [0079](../../../docs/adr/0079-auth-frontend-seam.md) — 認証の前面の継ぎ目。資格情報を持たず、IdP との往復を Route Handler へ渡す

---
imports-allowed: [model, errors, logging, config, observability]
forbidden: [components, capabilities, stores, business-logic]
test-requirement: unit
---

# auth

認証の境界です。session の封緘と復元、IdP との往復、確定認可の入口を持ちます。

## 親と違う点

親（`src/adapters/`）は `integration` を宣言しています。あれは
[0090](../../../../docs/adr/0090-testing-strategy.md) の「HTTP 境界のみを対象とし、内側は mock、
型と形をアサートする」要求で、**外部通信を持つモジュールにだけ意味があります**。

この区画で外部通信を持つのは 3 つだけです。

| 外部通信を持つ（`integration`） | 持たない（`unit`） |
| --- | --- |
| `oidc-discovery.ts` / `default-session-resolver.ts` / `development-token.ts` | `pkce.ts` / `random-token.ts` / `seal-key.ts` / `session-cookie.ts` / `session.ts` / `resolver.ts` / `optimistic-session.ts` / `test-session.ts` / `test-session-record.ts` / `development-session-resolver.ts` / `development-authorization-code.ts` / `development-access.ts` |

宣言を `unit` にしているのは、多数派がそちらであるためです。上の 3 つは HTTP 境界を持つので
`integration` の要求も併せて満たします。判定は「そのモジュールが外へ出るか」で行い、
ディレクトリの位置では決めません。`development-session-resolver.ts` は既定 Resolver を組み立てますが、
自分では外へ出ません（`startAuthorization` が返すのは同じ生成元の面です）。

## 受け入れるもの

- session の保管形式と、その封緘・復元
- IdP との往復（Discovery / 認可要求 / トークン交換）と、送り出す先の組み立て（認可・ログアウト）
- 確定認可の入口（`verifySession()`）と、Bearer の取り出し口

## 受け入れないもの

- 保護ルートの判定・`returnUrl` の検証・役割による認可。方式が変わっても変わらないため、
  Resolver の外（`model` と `proxy.ts`）が持ちます（[0079](../../../../docs/adr/0079-auth-frontend-seam.md) §6）
- `SessionRecord` を外へ出すこと。Access Token を含むため、内側へ渡すのは `Session` だけです。
  ただし **ID Token はログアウトの送り先に埋めて外へ出します** —— RP-Initiated Logout は
  `id_token_hint` を利用者のブラウザ経由で IdP へ届ける手順で、届かないと終わらせられません。
  出るのはこの 1 用途だけで、Access Token は今も外へ出しません

## client へ渡さないものの登録

`session.ts` が復元する記録には Access Token と ID Token が入ります。復元した時点で
[taint](../taint/taint.ts) に登録するので、記録をそのまま Client Component へ渡すと描画が落ちます。
署名鍵（`AUTH_SESSION_SECRET`）は読む側である `resolver.ts` が登録します —— `config` は
`imports-allowed: []` で react を持ち込めないためです（[0030](../../../../docs/adr/0030-environment-variable-management.md) §8）。

内側の層へ渡してよいのは `verifySession()` が返す身元だけ、という約束が主で、登録はそこを抜けた
ときに実行時で捕まえる補助です。

## 差し替え点

`session-resolver.ts` の `SessionResolver` が唯一の差し替え単位です。テンプレートから作った側が自社方式へ移るときは
`resolver.ts` が返す実装を替えます。cookie を扱う側は封緘された文字列しか触らないため、方式が
変わっても書き直しになりません。

同梱するのは 2 つです。

| 実装 | いつ選ばれるか |
| --- | --- |
| `default-session-resolver.ts` | 既定。Authorization Code + PKCE で実在の IdP と往復する |
| `development-session-resolver.ts` | `AUTH_MODE=dev` かつ開発専用の口が開く環境。IdP の代わりに `/dev/session` へ送り出す |

**開発用は面を狭めません。** 送り出す先と、認可コードの交換だけを差し替え、封緘・復元は既定
実装をそのまま借ります。cookie の形が方式で変わると、片方で作った session をもう片方が読めなくなり、
環境変数を切り替えただけで入り直しが要ります。

**選ぶ判定は環境と併せます**（`resolver.ts`）。`AUTH_MODE` だけを条件にすると、設定を誤って実環境へ
`dev` を与えた瞬間に、IdP を通らずに任意の役割で入れる経路が公開ドメインで開きます。

**開発用の認可コードは、発行元の要求へ束ねます。** 指定だけを封緘すると、コードを持っている側が
自分で新しい往復を始めて交換できてしまいます（一時状態の消費が止められるのは「自分の往復を自分で
もう一度使うこと」だけ）。実在の IdP では PKCE の検証子が同じ役目を負っており、その性質を開発用の
経路でも保ちます。

## 隣に置くもの

- 認証の往復の口は [`src/app/api/auth/`](../../../app/api/auth)
- 入口の楽観判定は [`src/proxy.ts`](../../../proxy.ts)

## 関連する ADR

この区画のコードが依存する決定です。**コメントからは ADR を直接指さず、この節を辿ります**
（[docs/rules.md](../../../../docs/rules.md)「コメントと文書」）。層全体の一覧は
[親の README](../../README.md) が持ちます。

- [0079](../../../../docs/adr/0079-auth-frontend-seam.md) — 認証の前面の seam。IdP を検証せず資格情報を中継し、サインインの面は自分で持つこと
- [0030](../../../../docs/adr/0030-environment-variable-management.md) — secret の読み方と、client へ渡せない値を登録する口
- [0070](../../../../docs/adr/0070-backend-role-separation.md) — 身元の扱いと、認可の判断をバックエンドから奪わないこと
- [0043](../../../../docs/adr/0043-middleware-policy.md) — 入口（`proxy.ts`）が持てるのは楽観判定までであること
- [0021](../../../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界
- [0090](../../../../docs/adr/0090-testing-strategy.md) — 層別の検証責務（`integration` が掛かる範囲）

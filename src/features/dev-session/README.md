---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features]
test-requirement: feature
---

# dev-session

IdP を通さずに session を発行し、保護された画面へ入るための開発用画面です。

## 受け入れるもの

- 発行する session の指定（誰として / 役割 / 失効までの秒数 / トークンを取りに行くか / その接続先 / 貼る Access Token）の入力と検証
- いま持っている session の表示と、それを捨てる操作の見せ方
- 認可の往復の途中で開かれたときに、送信先を認可 endpoint へ替え、対応づける値を載せること
- 認可 endpoint が戻した理由の語彙・読み取りと、その文言

## 受け入れないもの

- session の封緘と復元（`adapters/server/auth` の領分。触れてよいのは app 層です）
- 口を開けてよい環境の判定（`config` が持ち、route と Server Action が当てます）
- 実在の IdP との往復（この画面はそれを通らないための画面です）
- 対応づける値が正しいかの判定（突き合わせるのは `/api/auth/callback` が復元する一時状態です）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/dev/session` | [`screen`](../../../docs/spec/route/dev/session/page.screen.md) / [`function`](../../../docs/spec/route/dev/session/page.function.md) | 不要（開ける環境の判定が代わりに掛かる） |

`/dev/session/authorize` は同じ画面が送信先に選ぶ Route Handler で、画面ではありません。

**operationId は使いません。** バックエンドの契約を一切引かない画面です。トークンを取りに行く
経路も IdP 側の口で、`openapi/api.gen.yaml` には現れません。

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| 開発用 session | session を持っていない | `Page/DevSession/WithoutSession` |
| | session を持っている | `Page/DevSession/WithSession` |

loading / empty / error の 3 つは持ちません。**取得が無いためです** —— 画面が読むのは cookie から
復元した現在の session だけで、失敗は操作の戻り値として `form-state.ts` の型に載ります。

## 構成

| ファイル | 役割 |
| --- | --- |
| `paths.ts` | この画面のルートと認可 endpoint、戻り先・対応づける値の受け渡しの名前 |
| `authorize-error.ts` | 認可を成立させられなかった理由の語彙と、戻す行き先の組み立て |
| `read-authorize-error.ts` | URL から理由を読む側。組む側と分けてある |
| `parse-session-form.ts` | 送信された `FormData` を発行に渡せる形へ解く |
| `form-state.ts` | 2 つの操作の戻り値の型と、route から渡される送信先の型 |
| `view.tsx` | いまの session と発行の指定を縦に並べる |
| `ui/current-session/` | いまの session の表示と、捨てる操作 |
| `ui/session-form/` | 発行の指定。client island |

> トークンを IdP から取る手順は、この画面ではなく
> [`adapters/server/auth/development-token.ts`](../../adapters/server/auth/development-token.ts) が持ちます。

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `model` | 発行の指定と戻り値の型（`action-state` / `session`）、URL の値の読み |
| `components` | 入力の面を組む器（入力欄・切り替え・カード） |
| `observability` | 描画を span に載せる |

**`adapters` を引きません。** session の封緘へ触れてよいのは app 層だけで、この画面が呼ぶのは
Server Action です（下記）。

## Action 戻り値契約

**置き場は feature の下ではなく app 層です。** 理由は「設計上の判断」の 1 つめ。

| Action | 置き場 | 戻り値 | 成功後 | 失敗時 |
| --- | --- | --- | --- | --- |
| `issueDevSessionAction` | `src/app/dev/session/actions.ts` | `DevSessionFormState` | session を置き、戻り先へ `redirect` | 項目ごとの理由を画面に残す |
| `discardDevSessionAction` | 同上 | `DiscardSessionFormState` | cookie を落として同じ画面へ戻す | 分類だけを返す |

認可の往復の途中で開かれたときは、送信先が `/dev/session/authorize`（Route Handler）に替わり、
上の Action は通りません。**その経路の失敗は分類だけを URL で戻します** —— 素の送信は状態を
持ち越せないためです。

## テスト観点

- [ ] 開ける環境の判定が、画面と Server Action の両方に掛かる
- [ ] 認可の往復の途中では session をここで置かず、認可コードを callback へ渡す
- [ ] 貼った Access Token を読み返す欄が無い
- [ ] IdP が応えなかった段（立っていない / 宛先違い）で文面が分かれる

## 使い方

**この画面は開発と CI の手元の宛先でだけ開きます。** production build には route ごと入りません。

### 1. モックで画面の動きを見る

```bash
APP_ENV=ci pnpm dev
```

バックエンドを起動せずに済みます（`APP_API_MODE=mock`）。`/dev/session?returnUrl=<保護された画面>` のように
戻り先を付けて開き、誰として・どの役割で入るかを決めて「この内容で入る」を押すと、その画面へ着地します。
**Access Token は空欄で足ります** —— モックには Bearer を検証する先がありません。

**この環境では `/login` からもここへ来ます。** `ci` は `AUTH_MODE=dev` を置いており、認可の開始先が
IdP ではなくこの画面になります（`env/README.md`）。**その経路で来たときは送信先が変わります** ——
認可 endpoint（`/dev/session/authorize`）へ素の form で送り、そこが認可コードを持って
`/api/auth/callback` へ戻します。session を置くのは callback で、この画面は指定を渡すだけです。
直接開いたときは今までどおり、その場で発行して戻り先へ着地します。

契約から生成したモックの応答は毎回値が変わるため、明細に事情が立っていることがあります。
**確定まで押したい場合は実データで通してください。**

### 2. 実データで通す

```bash
APP_ENV=local pnpm dev
```

**通常のログイン（`/api/auth/login`）が使えるならそちらが正**です。この画面は、リダイレクトを
通せないときや、特定の主体で入り直したいときの代わりに使います。

**「API 接続モード」を入れると、トークンはこの画面が取ります。** 「誰として入るか」に入れた主体で
開発用 IdP を叩き、返ってきたトークンを session に載せます。手で別の口を叩いて写す必要はありません
——写し間違いと期限切れが「画面が壊れている」として現れるのを避けるためです。

**「IdP の接続先」は書き換えられます。** 初期値は設定（`AUTH_ISSUER`）ですが、固定ではありません
（理由は「設計上の判断」の「接続先は設定から固定しません」）。ずれたまま取るとトークンは出るのに API で 401 になり、原因が「取り方」ではなく
「取った先」であることが応答から読めません。API の接続先（`APP_API_BASE_URL`）と同じ組の IdP を
指してください。

主体はバックエンドに登録されているものを使います。登録されていない主体はトークンこそ出ますが、
API の側で解決できず 401 になります。管理側の画面を見るなら、`admin` の役割を持つ主体が要ります。

> **取り方は `adapters/server/auth/development-token.ts` が 1 か所で持ちます。** 通るのは
> **OIDC Discovery を公開し、Resource Owner Password Credentials で主体を名指しできる開発用 IdP**
> です（本物の IdP で使ってはならない付与方式です）。画面と Server Action は「主体と接続先を渡すと
> トークンが返る」ことしか知りません。
>
> 宛先がその性質を満たさないときは、**どの段で応えなかったか**を宛先付きで返します —— IdP を立て
> 忘れたのか、宛先を打ち間違えたのかが、同じ文面にならないようにするためです。

モックへ繋いでいる間（`APP_API_MODE=mock`）は、この切り替えは既定で切れています。Bearer を検証する
先が無いためで、そのままで足ります。自分で取ったトークンを使いたいときは、切り替えを切ると貼る欄が
出ます。

### 3. 失効の見え方を確かめる

「失効までの秒数」を短くして入り、その秒数を過ぎてから保護された画面を開きます。**戻り先を付けた
ログイン画面へ送られます**（実測）。待たずに踏めるのがこの欄の目的です。

### 4. 別の主体で見る

「session を捨てる」で cookie を落としてから入り直します。捨てずに入り直しても上書きされますが、
捨てた状態の画面（未認証で保護ルートを踏んだときの挙動）も確かめられます。

## 設計上の判断

**送信先はこの画面が決めません。** session の封緘は `adapters/server/auth` の領分で、そこへ触れて
よいのは app 層です（`architecture.ts` の `adapters-auth`）。したがって Server Action は
`src/app/dev/session/actions.ts` にあり、この画面は受け取った送信先を `useActionState` へ渡すだけです。

**認可の往復の途中なら、session をここでは置きません。** 認可コードを `/api/auth/callback` へ渡し、
置くのは向こうにさせます。ここで置いてしまうと、`AUTH_MODE=dev` の間だけ callback が一度も踏まれず、
認可の往復が壊れていても開発と CI では最後まで気づけません。

**その送信は Server Action ではなく Route Handler へ出します。** Server Action の `redirect()` は
Route Handler へ遷移できません —— client router が飲み込み、要求そのものが出ず、URL だけが
書き換わります（実測）。素の form 送信ならブラウザが遷移します。実在の IdP でもログイン画面は
認可 endpoint へ送信し、そこが応答を持って戻すので、形としてもそちらが実物に近くなります。

**認可 endpoint の判定は受け口の隣が持ちます。** `route.ts` に許される import 先は
`adapters/server` / `errors` / `logging` で、原則は thin proxy です。form の解析も失敗の分類も
`features` の語彙なので、`src/app/dev/session/authorize-development-session.ts` が持ち、口は「閉じる・呼ぶ・
HTTP の形へ直す」だけにしています。**送信の本体の上限もそちらが持ちます** —— `next.config.ts` の
`bodySizeLimit` は Server Action にしか及ばず、Route Handler へ寄せた時点で外れるためです。

**その経路では、失敗は分類だけを URL で戻します。** 素の送信は状態を持ち越せないため、項目ごとの
理由は出ません。実在の IdP の認可 endpoint も `error` の分類しか戻さないので、そこで揃います。
項目ごとの理由は、自分の画面へ留まる送信（その場で発行する経路）が持ちます。

**開ける環境の判定は入口ごとに置きます。** route（画面）と Server Action は別々の入口で、Server Action は
画面を経由せずに呼べます。片方だけ閉じても閉じたことになりません。

**トークンの取り方はこの画面が持ちません。** 相手の IdP に固有の手順で、繋ぐ先を替えたら変わる
ものです。画面が知っているのは「主体と接続先を渡すとトークンが返る」ことだけで、実際に取るのは
`adapters/server/auth` です（触れてよいのは app 層なので、呼ぶのは Server Action です）。

**接続先は設定から固定しません。** 開発機ではバックエンドを複数の口で並行して立てるため、設定が
指す IdP と、いま叩いている API が期待する IdP がずれます。**どれが正かを知っているのは、その場で
繋ぎ先を選んでいる人**なので、設定の値を初期値として出し、書き換えられるようにしています。

**Access Token は画面に出しません。** ブラウザから観測できないことが session をこの形にしている理由
そのもので、確かめるために出すとその性質を自分で壊します。貼る欄はあっても、貼った値を読み返す欄は
ありません。

**失効までの秒数を指定できます。** 失効したあとに保護された画面がどう見えるかを、待たずに踏める
ようにするためです。

## 関連する ADR

- [0021](../../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。session の封緘へ触れてよいのが app 層だけである根拠
- [0025](../../../docs/adr/0025-app-layer-elements.md) — app 層の構成要素。Route Handler は thin proxy に留め、判定は隣へ置く
- [0029](../../../docs/adr/0029-type-design-discipline.md) — 判別可能 union と境界での parse。送信された `FormData` の解き方
- [0053](../../../docs/adr/0053-ui-component-interaction-seam.md) — 操作の a11y 継ぎ目。入力の面が守る継ぎ目
- [0079](../../../docs/adr/0079-auth-frontend-seam.md) — 認証の前面の継ぎ目。ブラウザから session を観測できないという性質

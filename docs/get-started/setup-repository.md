# セットアップ手順

このボイラープレートを自分のプロジェクトとして立ち上げるまでの手順。**上から順に実行する**。
順序に依存する箇所は各節に明示してある。

各手順の中身は、それを所有するドキュメントが正である。ここが持つのは**順序と、人手が要る箇所**だけ。

## 0. 前提

| | |
| --- | --- |
| [mise](https://mise.jdx.dev) | ツール / ランタイムの版管理。**シェルで activate しておくこと**（[0003](../adr/0003-version-manager.md)） |
| GitHub CLI (`gh`) | リポジトリ運用の make ターゲットが使う。`gh auth login` 済みであること |
| Docker | 手順 6 でのみ使う。基準画像は digest 固定したコンテナの中でしか撮らない（[`vrt/README.md`](../../vrt/README.md)） |

## 1. 手元を用意する

```bash
git clone --recurse-submodules <自分のリポジトリ>   # VRT の基準画像がサブモジュール
cd <リポジトリ>

make install-tools
pnpm install
pnpm exec lefthook install   # 自動では入らない。clone 後に 1 度だけ
```

**`lefthook install` は基準画像の追随にも要る。** git はブランチを移っても submodule の実体を
動かさないため、撮り直しで指し先が進むと実体が取り残され、`git status` に `baseline/images` が
出続ける。**その汚れを commit すると間違った指し先が載る。** hook が移動と pull のたびに実体を
指し先へ合わせるので、入れておけば手で直すことはない（[0151](../adr/0151-git-hooks.md)）。

入れ忘れても壊れはしない。リリースブランチを切る口はこの汚れだけを見分け、合わせ直す手を
名指しで案内する（`scripts/release`）。

## 2. リポジトリを初期化する

```bash
make setup-repo
```

**破壊的**。既存タグをローカルと `origin` の両方から全削除し、`v0.0.0` を打ち直す。
`develop` / `staging` / `production` を作り、デフォルトブランチ・ルールセット・ラベル、および
ドキュメントサイトの配信設定（Pages を Actions 配信にし、`production` からの配信を許可する）を
入れる。中身は [`.makefiles/README.md`](../../.makefiles/README.md) を参照。

**配信の許可は、忘れると原因が読めない形で落ちる。** `github-pages` environment が配信元ブランチを
許可していないと、`docs-deploy` は job としては起動するが step を 1 つも実行せずに失敗する。
ログに理由が出ないため、`docs-build` が緑であることと合わせて「組み上がっているのに公開されない」
状態になる。配信元を `production` 以外にするなら、`PAGES_DELIVERY_BRANCH` と
[`deploy-docs.yaml`](../../.github/workflows/deploy-docs.yaml) の push トリガを揃えて変える。

## 3. GitHub の画面で設定する（人手）

`gh` では代行できないものだけ。

1. **Actions を有効にする** — 作成直後は無効になっていることがある
2. **Dependency graph を有効にする** — Settings → Security → Dependency graph。Dependabot が依存の木を
   読むのに要る（[0110](../adr/0110-security-operations.md)）。有効化そのものに課金は無い
   （**このリポジトリでは `dependency-review` job もこれを読む**ため、無効のままだと「このリポジトリでは使えない」で落ちる。設定を入れるまでコード側では直せない） <!-- boilerplate-only:line -->
3. **必須チェックを確認する** — `make setup-repo` が適用したルールセットの `required_status_checks` が、
   1 度 CI を回した後に実際の context 名と一致しているか見る（[`.github/workflows/README.md`](../../.github/workflows/README.md)）

## 4. 自分のリポジトリの姿にする

```bash
make setup-replace-repository-reference REPOSITORY=<owner>/<repo>
make setup-replace-license-copyright COPYRIGHT_HOLDER='<著作権者>'
make setup-remove-boilerplate-only   # boilerplate-only:line
```

いずれも `DRY_RUN=1` で書き換えずに予定だけ出せる。

1 つ目はドキュメントポータルへのリンクも差し替える。差し替え先の既定は GitHub Pages の配信先
（`https://<owner>.github.io/<repo>/`）で、custom domain を当てる場合だけ
`PORTAL_URL=https://docs.example.com/` を足す。**手順 3 で Pages を有効にしていなくても実行してよい** —
URL の形は Pages の有効化ではなく `<owner>/<repo>` が決めるため、後から有効にしてもリンクは合う。

<!-- boilerplate-only:begin -->
3 つ目は**この template を配る側にしか意味を持たない記述**を剥がす
（[0152](../adr/0152-agents-md-policy.md)）。飛ばす選択肢は無い —— テンプレートから作った時点で前提が
失効しているので、残すと自分に効かない規則に従うことになる。剥がし終えると道具自身も消える。
<!-- boilerplate-only:end -->

## 5. 同梱サンプルを破棄する

```bash
make setup-remove-sample   # DRY_RUN=1 でプレビュー
```

題材を持つ画面群と、その題材に固有の契約・モック・破棄の道具そのものを消す。
破棄後に整形・検査・build・test まで連鎖するので、参照の消し残しはその場で判る。

サンプルを残して使う場合はこの手順を飛ばす。ただし**次の手順より先に済ませたほうがよい** —
破棄はサブモジュールの中へ届かないため、逆順にすると題材の基準画像を自分の置き場に撮ってしまう。

### 破棄後に自分で書き換えるもの

[`src/model/authz.ts`](../../src/model/authz.ts) の `ROUTE_POLICIES` は、破棄すると `/account`
（認証だけを求める）と `/admin`（役割まで求める）の 2 件が残る。これは**保護するパスをどこに
何と宣言するか**を示すための置き場であり、その画面は同梱していない。自分の保護対象へ書き換える
こと。列挙するのは保護する側で、公開側ではない — 公開側を列挙すると、新しく足した画面が既定で
公開になり、書き忘れがそのまま漏洩になる。

**求める役割が違う 2 件を残してある。** 認証だけを求める宣言しか無いと、役割が足りない主体を
弾く経路がどこにも無くなり、その分岐を通す入力を作れなくなる。

判定は前方一致なので、`/` は置けない。すべてのパスに一致し、`/login` 自身も保護対象になって
リダイレクトが循環する。

`env/.env.local` と `env/.env.ci` の接続先は、破棄すると**どれも実在しない置き場所**になる
（`APP_API_BASE_URL` / `MEDIA_ORIGIN` / `AUTH_ISSUER` / `AUTH_CLIENT_ID`）。値の意味と、どこまでが
必須かは [`env/README.md`](../../env/README.md)。`MEDIA_ORIGIN` は画像を 1 枚も置かない間も必須で、
`next/image` の許可 host と CSP の `img-src` をこの値だけが決める。

## 6. VRT の基準画像の置き場を用意する

### 6-1. 置き場を作る

```bash
make setup-baseline-store
```

3 つ聞かれる。既定でよければ Enter。

```text
既存のリポジトリへ配置しますか? 空欄なら新規作成 [<org>/<repo>]:   ← 空欄で新規作成
作成するリポジトリ名 [<現在のリポジトリ名>-baseline-images]:
公開範囲 (public / private / internal) [private]:
```

組織で新規作成が権限で縛られている場合は、最初の問いに既存の `<org>/<repo>` を入れる。

**公開範囲は既定で `private`。** 基準画像は画面の見た目そのものなので、公開側へ倒れる既定は取らない。
ただし**置き場を非公開にすると、外部（fork）からの PR で `vrt` が落ちる** — fork の PR には
secrets が渡らず、基準画像を読む App トークンを取れないため。外部の PR を受けるリポジトリは `public`。

終わったら配線をコミットする。

```bash
git add .gitmodules baseline/images
git commit -m "Build: 基準画像の置き場を配線する"
```

> **置き場にルールセットを掛けないこと。** 撮り直しは GitHub App の push で行うため、
> 保護を掛けると更新経路そのものを塞ぐ。

### 6-2. GitHub App を作る（人手）

自動化できない。REST に作成の口が無く、秘密鍵は生成時に一度しか表示されない。

<https://github.com/settings/apps/new> で作る。

| 項目 | 値 |
| --- | --- |
| GitHub App name | `<現在のリポジトリ名>-baseline-images-app`（**GitHub 全体で一意**） |
| Description | `<現在のリポジトリ名>-baseline-images の visual regression test 用` |
| Homepage URL | `https://github.com/<owner>/<現在のリポジトリ名>` |
| Webhook | **Active のチェックを外す** |
| Repository permissions → Contents | **Read and write** |
| Repository permissions → Pull requests | **Read and write** |
| その他の permissions | No access のまま |
| Where can this GitHub App be installed? | **Only on this account** |

`web` や `frontend` のようなありふれたリポジトリ名では既に取られていることがあるので、その場合は
owner 名などを足す。名前は後から変えられる（slug も追随するが、変えたら `make setup-baseline-app` を
叩き直すこと）。

作成後、続けて 3 つ。作成直後に着地するのが **General** ページなので、上から順に済ませられる。

1. **App ID を控える** — General ページの上部に数字で出ている。次の 6-3 で貼り付ける
2. **General → Private keys → Generate a private key** → `.pem` がダウンロードされる
3. **Install App** → **Only select repositories** で**本体と置き場の 2 つだけ**

`Pull requests` が要るのは、保護されたブランチ（`release/**` / `hotfix/**` と各環境のブランチ）では
撮り直しがポインタを直接 push できず、PR で入れるためである（[`vrt/README.md`](../../vrt/README.md)）。

> **後から権限を足したときは、installation 側で承認するまで効かない。** App の設定を変えただけでは
> 足りず、`https://github.com/settings/installations/<id>` に出る "Review request" を通す。承認して
> いないと、撮り直しはトークンの発行そのものが
> `422 The permissions requested are not granted to this installation.` で落ちる。

### 6-3. App を登録する

```bash
make setup-baseline-app
```

```text
App ID（General ページの App ID）:           ← 6-2 で控えた数字

  App ID : ...
  登録先 : <owner>/<repo>

この内容で登録しますか (y/N) [N]:            ← y

秘密鍵 (.pem) のパス:                        ← 端末へ .pem をドラッグしてもよい
```

`App ID: 2168345` のようにラベルごと貼っても通る。

**登録が済んだら `.pem` を消すこと。** ブラウザが落とした実体がそこにある。

```bash
gh secret list   # BASELINE_APP_ID / BASELINE_APP_PRIVATE_KEY が並ぶ
```

### 6-4. 最初の基準画像を撮る

Docker が要る。**2 つある。**置き場は story 単位と画面単位で共有し、区画だけが分かれる
（[`baseline/README.md`](../../baseline/README.md)）。片方だけ撮ると、もう片方は「基準画像が無い」で
全数落ちる。全数を撮るので時間がかかる。

```bash
make vrt-retake   # story を撮って置き場へ送る
make e2e-retake   # 画面を撮って置き場へ送る
git commit -am "Test: 基準画像を撮る"
```

送った結果が出る。

```text
before=<置き場の直前のコミット>
after=<撮影したコミット>
count=<動いた枚数>
```

以降の運用（撮り直し・承認・掃除）は [`vrt/README.md`](../../vrt/README.md) が正。画面単位の側は
[`e2e/README.md`](../../e2e/README.md) を見る。

## 7. 自分の契約を入れる

`openapi/sources.yaml` に自分のバックエンドの契約の座標を書き、生成し直す。

```bash
make fetch-api
make gen-api
```

## 8. 認証済みの画面を手元で見る

手元では `/dev/session` が開いており、**IdP のリダイレクトを通さずに session を発行できる**。
主体と役割を決めて「この内容で入る」を押すと、指定した画面へ着地する。この口は開発と CI の手元の
宛先でだけ開き、production build には route ごと入らない。

実物のバックエンドへ繋いでいるときは、**「API 接続モード」を入れる**とアクセストークンもこの画面が
取る。「IdP の接続先」は設定（`AUTH_ISSUER`）を初期値に置いているが書き換えられるので、**いま叩いて
いる API と同じ組の IdP** を指すこと。口を分けて並行して立てていると、設定の値とずれる。

トークンの取り方は
[`src/adapters/server/auth/development-token.ts`](../../src/adapters/server/auth/development-token.ts)
が 1 か所で持つ。相手は製品ではなく性質で決まり、**OIDC Discovery を公開し、Resource Owner Password
Credentials で主体を名指しできる開発用 IdP** なら何でも通る（本物の IdP で使ってはならない付与方式を、
照合する相手が居ないから使っている）。**別の IdP へ移るなら、書き換えるのはこのファイルだけ**でよい。
画面も Server Action も「主体と接続先を渡すとトークンが返る」ことしか知らない。

詳しい使い方は [`src/features/dev-session/README.md`](../../src/features/dev-session/README.md)。

## 確認

```bash
pnpm lint:ci && pnpm typecheck && APP_ENV=local pnpm build && pnpm test
```

CI 側は PR を 1 本立てれば全ジョブが回る。落ちたジョブの引き先は
[`.github/workflows/README.md`](../../.github/workflows/README.md)、詰まったときは
[`.claude/skills/repo-ops`](../../.claude/skills/repo-ops/SKILL.ja.md)。

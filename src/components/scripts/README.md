# ui scripts

`components/scripts/` は、shadcn/ui の copy-in と、その来歴情報の更新・追従確認を実行するスクリプトを置きます。

## 実行

```sh
pnpm add:ui button --as=action
pnpm add:ui dialog --as=overlay -- --yes
pnpm add:ui button --as=action -- --dry-run
pnpm check:ui
```

一度に追加できる部品は一つです。`--` より前には部品名とラッパー自身のオプション、後ろには `shadcn add` へ渡すオプションを書きます。CLI が一時的に出力する `design-system/<component>.tsx` は、ラッパーが層と見出しに応じた場所へ移動します。`--path` は指定できません。

`--as=<見出し>` は必須で、その部品が component 目録のどの見出しに載るかを指定します。取り込みの前に決めさせるのは、後回しにすると実装が終わった時点で目録へ載せる作業だけが残り、`pnpm check:ui` が落ちるまで誰も気付けないためです。指定できる見出しは `../README.md` の component 目録と同じで、値が違えば `shadcn add` を走らせる前に失敗します。

## 依存の追加が root へ向かうこと

shadcn CLI は取り込む部品の npm 依存を `pnpm add` で入れますが、`-w` を付けません。このリポジトリは
ワークスペースを持つため pnpm が root への追加を拒み、**ファイルが 1 つも書かれないまま**取り込みが
止まります。依存インストールはファイル書き出しより先に走るので、部品の種類に依らずすべて止まります。

CLI 側に抑止する口が無いので、`add:ui` の実行時にだけ `npm_config_ignore_workspace_root_check` を
立てて許可します。`.npmrc` に置かないのは、そこへ書くと**あらゆる `pnpm add` で root への誤追加が
黙って通る**ためです。許可の範囲は `pnpm add:ui` の 1 回に閉じ、手で打つ `pnpm add` には効きません。

## 依存部品の生成物

shadcn CLI はこのリポジトリの層と目的による配置を知らないため、依存部品を `design-system/<name>.tsx` へ出力し、取り込んだ component からは `@/components/design-system/<name>` を import します。ラッパーは移動のあとにこれを整理します。

- 既に取り込まれている依存は、生成された `design-system/<name>.tsx` を削除し、取り込んだ component の import を実体への相対パスへ向け直します。相対の深さは層と目的の組み合わせで決まるため、実体を探して算出します
- 実体がまだ無い依存は削除も書き換えもせず、部品名を標準出力へ知らせます。生成物と `@/components/design-system/<name>` の import は解決するため型検査は通りますが、取り込み順としては先にその部品を取り込み・監査します

この整理を行わないと、実体の重複と解決しない import が同時に残り、次に `pnpm typecheck` を回した別の作業まで巻き込んで失敗します。

## manifest

`../shadcn-manifest.yaml` は、design system の各 component が上流とどういう関係にあるかを記録する台帳です。`pnpm add:ui` の成功時に copy-in のエントリを upsert します。`--dry-run` では更新しません。自前実装のエントリは、その component を作った作業で手で追加します。

```yaml
select:
  kind: copy-in
  as: form
  layer: design-system
  directory: src/components/design-system/form/select-client
  registry: https://ui.shadcn.com
  addedAt: 2026-08-02T03:35:28.433Z
  shadcnCliVersion: 4.15.0
  dependencies:
    - radix-ui
  source:
    - repository: shadcn-ui/ui
      path: apps/v4/registry/new-york-v4/ui/select.tsx
      localPath: src/components/design-system/form/select-client/select-client.tsx
      commit: f31ed8198365...
      committedAt: 2026-03-02T08:49:00Z
```

### 名前と置き場所

**key は実体を指すラベル、`registryItem` は上流の item 名**です。両者は別の関心なので別のスロットに置きます。上流の名前を key に畳むと、同じ item から native / client の 2 実装を作ったときに表現できません（`checkbox` から `checkbox-native` と `checkbox-client` を作るなど）。

- **key** — 原則として実体のディレクトリ名にします。`patterns/table` と `design-system/display/table` のように衝突する場合だけ修飾します（`table-columns`）
- **`registryItem`** — 上流の item 名です。`original` は上流を持たないため**書きません**
- **`directory` / `localPath`** — 実体の置き場所です。名前から推測しないため、実体を移動・改名しても対応が壊れず、記録漏れと取り残されたエントリの両方を検出できます
- **`dependencies`** — 実装が実際に import している外部 package です。registry が「入れろ」と宣言した値ではなく、置いた実装が参照しているものを記録します。取り込み時の書き換えや自前実装で参照は変わるため、宣言と実態は一致しません。`react` / `react-dom` は全 component が前提にする実行環境なので数えず、`next/image` は `next` として数えます。参照が無ければ書きません
- **`as`** — component 目録で載る見出しです。目的を表します

`layer` と `as` は畳みません。**`layer` が「誰が書き換えるか」、`as` が「何のための部品か」**で、軸が違います。`design-system` だけが目的別の中間ディレクトリを持ち、`patterns` と `app-starter` は目的を一つに決められないものの置き場なので割りません。`directory` はこの二つから導けるため、`pnpm check:ui` が突合します（入れ子の component は親が置き場を決めるので対象外）。

`pnpm add:ui` が記録した直後は key と `registryItem` が一致します。取り込み後に実体を改名・移動したら、key と `directory` を追随させ、`registryItem` は上流の名前のまま据え置きます。

`pnpm check:ui` は、`registryItem` の有無が `kind` と噛み合っているか、宣言した `registryItem` が `source[].path` のファイル名と一致するか、`dependencies` の宣言が実装の import と一致するか、`as` が目録の見出しにある値かを確認します。規約は説明ではなく検査で守られます。

`pnpm add:ui` は台帳を丸ごと書き直さず、対象のエントリだけを差し替えます。文書ごと再シリアライズすると、判断の経緯を書いたコメントが毎回消えるためです。

### kind

| 値 | 意味 | `source` | 上流が動いたとき |
| --- | --- | --- | --- |
| `copy-in` | registry から取り込み、上流を追従対象として持ち続ける | あり | 差分を読み、必要なら取り込む |
| `reimplemented` | 上流に相当する item はあるが、こちらの要件に合わせて自前で実装し直した | あり | 追従はしない。見直しの材料として差分を読む |
| `original` | 上流に相当する item が存在せず、最初から自前で作った | なし | 何もしない |
| `not-adopted` | 検討したうえで作らないと決めた。実体を持たない | なし | 何もしない |

`kind` を分けているのは、「manifest に無い」だけでは**自前実装なのか、まだ取り込んでいないのか**を区別できないためです。

`not-adopted` はその裏返しで、**「検討したのか、まだ見ていないのか」**を区別します。実体が無いので `layer` / `as` / `directory` を持たず、代わりに `reason` と `revisitWhen` が必須です。`revisitWhen` を必須にするのは、条件を書けない「やらない」が判断ではなく先送りだからです。registry に存在しない候補を退けた場合は `registryItem` も持ちません。

決定そのものの実体は、責務を引き取った component の `README.md` が持ちます。台帳側は「その名前を検討した事実」と「いつ考え直すか」だけを持ちます。`pnpm check:ui` はこの kind を実体との突き合わせからも上流追従からも外します。

### なぜ commit を記録するのか

`addedAt` と `shadcnCliVersion` はこちらが実行した時点を表すもので、取り込んだ内容が上流のどの時点のものかは示しません。それを担うのが `source` です。registry が配る JSON は上流リポジトリのファイルそのものであり、実体の位置は item 自身が `files[].path` として申告するため、こちらでパスを組み立てません。

CDN の `last-modified` はキャッシュ充填時刻であり内容の変更日ではありません。`etag` は実質が本文のハッシュですが、`Accept-Encoding` によって弱い検証子（`W/` 付き）に変わるため、記録して長期に突き合わせる値には使いません。

`source` の解決には registry と GitHub API への通信が必要です。取得できない場合でも追加自体は完了し、`source` を持たないエントリとして記録したうえで理由を標準出力へ知らせます。ネットワークを復旧してから取り込み直すと記録されます。

## 未定義 class の検出

`pnpm check:classes`（[`check-classes.ts`](./check-classes.ts)）が `src/app/globals.css` を build し、`src/components` 配下の `.tsx` に書かれた class がすべて出力に現れるかを照合します。Tailwind は認識できない class を黙って無視するため、これを機械で見ないと欠陥が browser まで届きます。

判定の要点は 3 つです。

- **照合は selector の形で行う。** `focus-visible:outline-2` は `.focus-visible\:outline-2` として出力されるため、素の文字列で探すと variant 修飾子の付いた class を取りこぼします
- **候補は `className` 属性と `cn()` / `cva()` の引数からだけ取る。** ファイル中の文字列をすべて拾うと `data-slot` の値や `role` まで候補に入ります。同じ領域に混ざる比較対象（`orientation === "horizontal"`）・`defaultVariants` の variant 名・index の key は候補から外します
- **意図して CSS を持たない class は `KNOWN_WITHOUT_CSS` に置く。** 検出結果から外すだけで、実装からは消しません

## 追従確認

```sh
pnpm check:ui             # 整合性 + 上流の追従確認
pnpm check:ui --offline   # 整合性だけ（通信しない）
```

実行すると、まず台帳の整合性を確認します。宣言した `directory` / `localPath` と実体の突き合わせ、
記録の無いディレクトリ、実体を失ったエントリ、同じ場所を二重に宣言したエントリ、`kind` と
`source` の食い違いを見ます。ここで問題があれば通信せずに終わります。

**台帳の対象は `src/components` 配下のすべての層です。** `design-system` だけでなく `patterns` /
`shell` / `app-starter` も含みます。層のディレクトリは列挙せず、
**`README.md` を持つディレクトリを component とみなします**。層を列挙すると、層が増える
たびにこの script を直す必要が生まれ、直し忘れた層が台帳から静かに抜けるためです。この
判定なら入れ子（`patterns/table` とその配下）も、層を移した component も記録漏れとして
現れます。判定の根拠は「component ごとに README を co-locate する」という
[`components/README.md`](../README.md) の規約です。

問題が無ければ、記録した commit と上流の最新を突き合わせ、動いた component を一覧します。`original` は上流を持たないため確認しません。`copy-in` は `要追従`、`reimplemented` は `参考` として区別して表示します。**上流が動いていた場合と、確認に失敗したものがある場合は exit code 1** で終わります。`make actions-pin-check` が pin のずれで落ちるのと同じ扱いです。

GitHub API へは記録件数ぶんのリクエストを出すため、未認証の 60 req/hr では足りません。`gh` の認証を使うので、実行には `gh` が必要です。

CI は [`shadcn-drift.yaml`](../../../.github/workflows/shadcn-drift.yaml) で 2 つに分けています。

- **台帳の整合性** — `src/components/**` を触った pull request で実行します。通信せず、原因もレビュー中の変更にあるため、ここは落として構いません
- **上流の追従確認** — 毎週月曜の定期実行と `workflow_dispatch` だけで動かし、pull request では動かしません。上流の drift はレビュー中の変更が原因ではなく、それで PR を落とすと作者が直せない理由で作業が止まるためです

## 上流の変更を取り込む

取り込んだ実装には TSDoc・import パス・型の修正が入っているため、上流の新しい内容をそのまま上書きできません。記録した commit があるので、当時の原本を base にした 3-way merge ができます。**原本をリポジトリに抱える必要はありません。**

```sh
# base   = 取り込んだ時点の原本（manifest の source.commit）
# theirs = 上流の最新
# ours   = このリポジトリの実装
REPO=shadcn-ui/ui
PATH_IN_REPO=<manifest の source.path>
BASE_SHA=$(<manifest の source.commit>)

curl -sS "https://raw.githubusercontent.com/$REPO/$BASE_SHA/$PATH_IN_REPO" -o /tmp/base.tsx
curl -sS "https://raw.githubusercontent.com/$REPO/main/$PATH_IN_REPO" -o /tmp/theirs.tsx
cp "$(<manifest の source.localPath>)" /tmp/ours.tsx

git merge-file /tmp/ours.tsx /tmp/base.tsx /tmp/theirs.tsx
```

競合が出た箇所だけを手で解決し、結果を実装へ戻します。取り込み直したら `manifest` の `source.commit` を新しい commit へ更新します（`pnpm add:ui <component> --as=<見出し> -- --overwrite --yes` で取り込み直すと自動で更新されますが、その場合は TSDoc などの修正も消えるため、3-way merge の方が実態に合います）。

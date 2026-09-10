# API 契約の取り込み

バックエンドの OpenAPI 契約をこのリポジトリへ取り込む場所です。契約は SSOT をバックエンドが持ち、
こちら側は**取得して固定する**だけを行います([0072](../docs/adr/0072-api-type-generation.md))。

## 構成

| パス | 役割 |
| --- | --- |
| `sources.yaml` | 取得座標の宣言。`name` / `repo` / `path` / `ref` は人が書き、`sha` / `fetchedAt` は取得時に書き戻される |
| `<name>.gen.yaml` | 取得物。**do-not-edit**。`make api-fetch` が上書きする |

取得物は `name` から一意に決まります(`api` → `api.gen.yaml`)。宣言側で出力先は指定できません。
名前と置き場所が別々に決まると、生成物がどの契約に対応するのかを宣言だけからは追えなくなるためです。

## 取得

```bash
make api-fetch            # sources.yaml の全契約を取得する
make api-fetch NAME=api   # 契約を 1 本だけ取得する
```

取得は生成を伴いません。取得したら `make api-gen` で型 / zod / MSW ハンドラを生成します。
取得したまま生成し忘れた状態は `make api-gen-check` が検出します。

生成物の置き場と読み方は [src/adapters/gen/README.md](../src/adapters/gen/README.md) が持ちます。 <!-- sample:line -->

`gh` の認証を使うため private リポジトリでも通ります。取得は GitHub Contents API 経由で、
レスポンスの `sha`(blob SHA)をそのまま版の根拠として使います。内容が変われば blob SHA も
変わるため、取り込み側でハッシュを計算し直す必要はありません。

## 版の記録

版は 2 か所に残ります。

- `sources.yaml` の `sha` — full blob SHA。どの契約を取り込んだかの記録
- 取得物の `info.version` — `2.2.0+aa62bff` の形。**取得物そのもの**が版を持つため、契約から
  生成した成果物との突合ができる

**blob SHA が指すのは契約の内容であって、バックエンドのコミットではありません。** どのコミット
から取ったかは `ref` が持ちます。`ref` にブランチやタグを書いた場合、その時点でどのコミットへ
解決されたかは記録されないため、コミットまで一意に辿りたければ `ref` をコミット SHA で固定します。

`fetchedAt` は取得時刻であり、版の同一性には関与しません。同じ `ref` を取り直せば `sha` は
変わらず `fetchedAt` だけが動きます。

## 複数契約

`sources.yaml` は複数の契約を並べられます。バックエンドが 1 リポジトリでも、契約が 1 本とは
限らないためです。

<!-- sample:replace-begin -->
現在の宣言は次の 1 本です。

| name | 契約 | 備考 |
| --- | --- | --- |
| `api` | go-boilerplate 本体の API | admin と一般が同居しており、tags でも `security` でも scope でも機械的に分割できないため 1 ユニットとして扱う |
<!-- sample:replace-with -->
<!-- = 宣言は空です。**`name` は `api` のまま使うのが既定です。** 取得先（`api.gen.yaml`）と版の -->
<!-- = 突合は `name` から導かれますが、生成の側は綴りを直に持っており、`orval.config.ts` の -->
<!-- = `apiInput.target` / `output.target` / `output.schemas` と `scripts/openapi/gen-api-plan.ts` の -->
<!-- = `GEN_API_OUTPUTS` を一緒に揃えないと、`make api-gen-check` が「生成物がありません」で止まります。 -->
<!-- =  -->
<!-- = **分けるかどうかは契約の側の都合で決めます** —— 1 本の契約に admin と一般が同居していても、 -->
<!-- = tags でも `security` でも scope でも機械的に分割できないなら 1 ユニットとして扱います。 -->
<!-- sample:replace-end -->

**認証の契約はここに置きません。** フロントが認証で使うのは OIDC Discovery が実行時に示す口
だけで（[`src/adapters/server/auth/`](../src/adapters/server/auth/README.md)）、契約から生成した
型を一切通らないためです。取り込む対象がそもそも無いので、IdP をどう用意したかには依存しません。

## ref の固定

`ref` はブランチ・タグ・コミット SHA のいずれも書けますが、**コミット SHA で固定します**。取り込む
契約が必ずタグの上に載っているとは限らず、タグを指すと「まだタグの無い変更を使いたい」場面で
ブランチへ緩めることになり、そこから先は取り込みが暗黙に動きます。上流の進展の取り込みは
`ref` の書き換えとして明示的に行います。

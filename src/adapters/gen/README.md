---
coverage-exclusions:
  - "src/adapters/gen/**"
---

# 契約からの生成物

`openapi/` に取り込んだ契約から `make api-gen` が生成する wire 型と zod スキーマの置き場です
([0072](../../../docs/adr/0072-api-type-generation.md))。**手で編集しません。** 編集しても次の生成で失われ、
CI の drift ゲートが差分を検出して落ちます。

## 構成

契約ごとに階層を切ります。契約は版が独立して動くため、突合と再生成を契約単位で回せる形にしています。

| パス | 中身 |
| --- | --- |
| `<契約名>/model/` | wire 型。契約の `components.schemas` に対応する |
| `<契約名>/endpoints.zod.ts` | operation ごとの zod スキーマ。response 検証に使う |
| `<契約名>/limits.ts` | 契約が定める上限・書式のうち、**検証を伴わない定数だけ**を写したもの。書き手は orval ではなく [`scripts/openapi/extract-limits.ts`](../../../scripts/openapi/extract-limits.ts)。client はこちらだけを引く（[0072](../../../docs/adr/0072-api-type-generation.md)） |

## 使い方の境界

- **response の検証はここの zod スキーマで行い、実施点は `adapters/server` の fetch wrapper です**
  ([0071](../../../docs/adr/0071-bff-api-integration.md))。バックエンドの response には server 側の
  runtime 検証が無く、フロントの生成 validation が契約破れの最後の砦になります
- **wire 型を内層へ渡しません**([0020](../../../docs/adr/0020-adopted-architecture.md) 設計原則 3)。
  `model` や feature が触るのは `adapters` が変換した後の型です。OpenAPI の制約は wire contract で
  あって domain rule ではありません
- **HTTP client はここにありません。** orval は client の出力先を必須としますが、outbound の
  resilience(timeout / retry / breaker)は `adapters/server` の手書き wrapper が所有します。生成された
  client は使わないため `mocks/` 側に置いてあります

## biome の扱い

このディレクトリは **linter の対象外**です(`biome.json` の `overrides`)。整形だけを掛けています。
書き手が居ないコードに規約を課すと、契約が変わるたびに生成器の出力作風で CI が止まり、
直す手段が「生成器にパッチを当てる」しか無くなるためです。生成物の正しさは、契約からの再生成が
一致するか(drift ゲート)で担保します。

## 再生成

```bash
make api-gen        # 契約から生成し、整形まで行う
make api-gen-check  # 契約と生成物の版が揃っているかだけを検証する
```

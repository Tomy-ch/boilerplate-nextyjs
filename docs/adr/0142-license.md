# ライセンス選定(MIT)

本リポジトリのライセンスを **MIT** とする根拠、**OSS 寄与ポリシー**、**同梱ライブラリとのライセンス整合**、および `package.json` の `private` フラグとの関係を定める。

## Status

Accepted

## 背景

前提:

- 本リポジトリは **テンプレートとして複製されることを目的とした表示層 boilerplate**([0011](0011-no-docker.md))であり、npm パッケージとして配布・`install` される性質ではない
- 依存ライブラリの許容ライセンスは [0004](0004-library-management.md) が規定する(MIT / Apache-2.0 / BSD-3-Clause / ISC / 0BSD のみ許可、GPL / AGPL / SSPL / 不明は不可)

## 決定

### 1. ライセンス = MIT

- 本リポジトリのライセンスは **MIT** とする(`LICENSE`: Copyright (c) 2026 Tomy-ch)。根拠:
  - **最大限の許容性**: 商用・改変・再配布・sublicense を制約なく許可し、本リポジトリを複製して任意の用途(商用含む)に使う目的に最も適う
  - **エコシステム標準**: Next.js・React をはじめ本リポの依存の大半が MIT / permissive であり、フレームワーク文化と摩擦がない
  - **姉妹リポジトリとの統一**: 同一著者の boilerplate 群(go-boilerplate)とライセンスを揃える
  - **低儀式性**: CLA・コピーレフトの義務を持ち込まず、テンプレート用途の障壁を最小化する
- Apache-2.0(特許条項)や BSD 系との比較でも、追加条項の要否がない本用途では MIT の簡潔さを優先する

### 2. OSS 寄与ポリシー = inbound = outbound(CLA なし)

- コントリビューションは **inbound = outbound**(投稿された貢献は成果物と同じ **MIT** の条件でライセンスされる)を既定とする。**別途の CLA / 著作権譲渡は要求しない**
- 著作権はコントリビュータが保持し、MIT の許諾のもとにリポジトリへ提供される形とする。`LICENSE` の Copyright 表記(`Tomy-ch`)は原著作者表記であり、貢献者の著作権を否定しない
- DCO(Developer Certificate of Origin)署名は必須化しない(必要になれば別途 `CONTRIBUTING.md` で規定 = 用途依存の運用強化)

### 3. 同梱ライブラリとのライセンス整合

- MIT で再配布可能であることは、**依存が permissive ライセンスに限られること**に依存する。この整合は [0004](0004-library-management.md) の許可リスト(MIT / Apache-2.0 / BSD-3-Clause / ISC / 0BSD)が担保する
- **コピーレフト(GPL / AGPL / LGPL)・SSPL・ライセンス不明の依存を混入させない**。これらは MIT 配布と両立しないため、依存追加時のライセンスチェックで排除する
- 個々の依存の帰属表記(attribution)保持義務は各ライブラリのライセンスに従う(本リポの `LICENSE` はリポジトリ自身の著作物に対するもの)

### 4. `package.json` の `private: true` と MIT の関係

- `package.json` は **`"private": true`** であり、これは **npm レジストリへの誤 publish を防ぐガード**である。本リポジトリは npm 配布物ではなく、テンプレートとして複製して使うものであるため、publish を意図的に無効化している
- `private: true`(npm 公開の抑止)と MIT(ソースの複製・改変・再配布の許諾)は**別レイヤの関心事**であり両立する。MIT は本リポのソースを複製・改変・再配布する権利を付与し、`private` は npm パッケージとしての配布経路を閉じるだけである
- `package.json` は SPDX 準拠のツール可読性のため **`"license": "MIT"`** を持つ。`private: true` と併記して矛盾しない(上記のとおり別レイヤ)

### 5. application 自体のライセンス

- ここを土台に構築する **application 自体のライセンスは用途依存**とする(out of scope)。MIT は派生物の再ライセンスを許すため、自プロジェクトに任意のライセンスを付与できる。ただし MIT の条件により、**boilerplate 由来部分の著作権表記・許諾表記の保持**が求められる点は Next.js 等の依存と同様に扱う

## 禁止事項

- ❌ コピーレフト(GPL / AGPL / SSPL 等)・ライセンス不明の依存を追加すること([0004](0004-library-management.md)。MIT 配布と両立しない)
- ❌ CLA / 著作権譲渡を貢献の必須条件として持ち込むこと(inbound = outbound を既定とする。強化は `CONTRIBUTING.md` で別途合意)
- ❌ `private: true` を「MIT を無効化するもの」と解釈すること(publish ガードとライセンス許諾は別レイヤ)
- ❌ `LICENSE` の Copyright 表記・許諾文を無断で除去・改変すること(Protected Documentation。[0152](0152-agents-md-policy.md) / AGENTS.md)

## 関連 ADR

- [0004-library-management.md](0004-library-management.md) — 依存ライセンス許可リスト(MIT 配布との整合を担保)
- [0011-no-docker.md](0011-no-docker.md) — テンプレート用途の表示層ロール(MIT 選定の背景)
- [0152-agents-md-policy.md](0152-agents-md-policy.md) / AGENTS.md — `LICENSE` は Protected Documentation(直接編集禁止)
- [0140-documentation-operations.md](0140-documentation-operations.md) — per-package README 運用

# バージョン管理方針

プロジェクトは **Semantic Versioning** を採用する。版はリリースブランチ名 `release/v<X.Y.Z>` が名乗り、
タグは `production` HEAD に打つ（[0150](../adr/0150-git-workflow.md)）。

## 版が指すもの

版が付くのは**テンプレートそのもの**である。テンプレートから作ったリポジトリは、作った時点のツリーを
写して自分の版を持つ。生成が写すのはツリーだけで、ブランチ保護や token の権限は複製されない ——
それらは設定ではなく「設定を適用する手順」（`make setup-repo`）として渡す
（[0010](../adr/0010-standards-and-non-lockin.md) §3）。

作った側がテンプレートの後の版を取り込む機構は同梱しない。矢印はテンプレート → 作った側の一方向で、
以後の追従は作った側の判断である。

## v1.0.0 の境界

v1.0.0 未満は、テンプレート自身の設計が固まっていく期間である。次が v1.0.0 で切り替わる
（[0140](../adr/0140-documentation-operations.md)）。到達時にこの節は消す。

| | v1.0.0 未満 | v1.0.0 から |
| --- | --- | --- |
| ADR | living document。本文を上書きし、改定履歴を残さない | immutable。Status 行のみ編集し、変更は新 ADR で supersede |
| 正典の言語 | 日本語（サフィックス無しのパス） | 英語 canonical + `*.ja.md` mirror |
| 保護文書の編集 | 都度承認を一時解除 | `AGENTS.md` / ADR 本文 / `LICENSE` は承認を要する |

## リリースブランチ戦略

release-centric のブランチモデルを採る（[0150](../adr/0150-git-workflow.md)）。

- 機能開発は**最新の `release/*`** から分岐し、PR の base も同じブランチ。GitHub のデフォルト
  ブランチは最新の `release/v<X.Y.Z>` へ張り替える
- `develop` / `staging` / `production` へは `release/*` 経由でしか反映しない。保護ブランチへの直接
  push、force push、履歴の書き換えは禁止
- `develop` を base に取ってよいのは `release/*` → `develop` の統合 PR だけ

## リリース手順

1. `production` から `make branch-patch` / `branch-minor` / `branch-major` で `release/v<X.Y.Z>` を
   切る。`package.json` の `version` はこのときブランチ名から焼き込まれ、CI（`package-version`）が
   一致を見る
2. `release/*` → `develop` → `staging` → `production` を別々の PR で昇格する
3. `.github/release/v<X.Y.Z>.md` にリリースノートを置く
4. `production` HEAD で `make tag-patch` / `tag-minor` / `tag-major` を実行する。直近のタグから次の
   版を計算してタグを打ち、リリースノートを本文に GitHub Release を作る。**ノートが無ければ失敗する**

### Hotfix

- `production` から切る。`make hotfix-patch` を使うと `hotfix/v<X.Y.Z>` となり、`version` の
  焼き込みもリリースブランチと同じに揃う
- `hotfix/*` → `production` の PR を作り、merge 後に同じ修正を `develop`（必要なら `staging`）へ
  反映する

## 原則

- `package.json` の `version` を手で決めない。版を決めるのはブランチ名で、`package.json` はそれに
  従う（手で直すなら `make version-stamp`）
- タグは make 経由で打つ。検査が届くのは「ブランチ名と `package.json` の一致」までで、ブランチ名
  そのものの正しさを保証するのは `make branch-*` が切る瞬間だけである
- 依存のメジャー更新は破壊的変更を引用した別 PR に分ける（[0004](../adr/0004-library-management.md)）

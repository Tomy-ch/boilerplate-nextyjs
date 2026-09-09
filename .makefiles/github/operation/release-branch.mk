## リリースブランチの操作コマンド

.PHONY: base-branch ## 最新のリリースライン(release/vX.Y.Z)のブランチ名を1行で出力する
.PHONY: base-merge ## ベースブランチを現在のブランチへ取り込み、未解決のパスを出力する
.PHONY: hotfix-patch ## hotfixブランチ(vX.Y.Z+1)を作成して、デフォルトブランチに設定(現在のタグ基準)
.PHONY: branch-patch ## releaseブランチ(vX.Y.Z+1)を作成して、デフォルトブランチに設定(現在のタグ基準)
.PHONY: branch-minor ## releaseブランチ(vX.Y+1.0)を作成して、デフォルトブランチに設定(現在のタグ基準)
.PHONY: branch-major ## releaseブランチ(vX+1.0.0)を作成して、デフォルトブランチに設定(現在のタグ基準)

# 解決は scripts/base-branch が持つ。出力はブランチ名 1 行だけで、案内は stderr へ出るので
# `$(make -s base-branch)` でそのまま受けられる。
base-branch:
	@pnpm exec tsx scripts/base-branch

BASE_MERGE_BASE_FLAG := $(if $(BASE),--base=$(BASE),)
BASE_MERGE_DRY_RUN_FLAG := $(if $(filter 1,$(DRY_RUN)),--dry-run,)

# 取り込みだけを持つ。衝突をどう裁くかは resolve-merge スキルの判断で、分類表はそちらが持つ。
# 衝突が残ると終了コード 1 で、未解決のパスを stdout へ 1 行 1 件で出す。
base-merge:
	@pnpm exec tsx scripts/base-merge $(BASE_MERGE_BASE_FLAG) $(BASE_MERGE_DRY_RUN_FLAG)

hotfix-patch:
	@pnpm exec tsx scripts/release branch hotfix patch

branch-patch:
	@pnpm exec tsx scripts/release branch release patch

branch-minor:
	@pnpm exec tsx scripts/release branch release minor

branch-major:
	@pnpm exec tsx scripts/release branch release major

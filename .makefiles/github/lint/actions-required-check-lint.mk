## 必須ステータスチェックの宣言と実体の突合の Lint
# required status check に登録した context が報告されない PR は、必須チェック待ちのまま
# 永久にマージできない。宣言する job の一意性と、pull_request がフィルタで
# 絞られていないことを検査する。actionlint はワークフロー単体しか見ないため表現できない。
# 異常終了は 2 通りで、規約違反は exit 1、検査そのものが成立していない状態 (宣言が読めない /
# ワークフロー 0 件) は exit 2。
.PHONY: actions-required-check-lint ## 必須ステータスチェックが全 PR で報告されるかを検査

ACTIONS_REQUIRED_CHECK_LINT := pnpm exec tsx scripts/required-check-lint

actions-required-check-lint:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@$(ACTIONS_REQUIRED_CHECK_LINT)

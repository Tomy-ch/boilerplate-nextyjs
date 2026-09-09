## PR コメント投稿ジョブへの secret 混入の Lint
# 検査ログをそのまま公開 PR コメントへ複製する upsert-pr-comment の性質上、本文を作る
# ジョブに secret を渡してはならない。actionlint はこの規約を表現できないため
# 専用の検査として持つ。異常終了は 2 通りで、規約違反は exit 1、検査そのものが成立して
# いない状態 (ワークフロー 0 件 / jobs: が読めない / 投稿ジョブの同定が壊れた) は exit 2。
.PHONY: actions-comment-secret-lint ## PR コメントを投稿するジョブへの secret 混入を検査

ACTIONS_COMMENT_SECRET_LINT := pnpm exec tsx scripts/actions-comment-secret-lint

actions-comment-secret-lint:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@$(ACTIONS_COMMENT_SECRET_LINT)

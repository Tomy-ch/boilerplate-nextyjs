## GitHub Actions 定義の Lint
# 走査対象は .github/workflows のみ。composite action (.github/actions/**) の
# action.yaml は actionlint へ直接渡すと workflow として解釈され必ず落ちるため
# 対象に加えない。workflows 側の `uses: ./.github/actions/...` 解決を
# 通じて検査されるのは、既に参照されている action の入力 (with: と inputs) の整合
# だけで、action 内の run: のシェルには及ばず、どの workflow からも参照されていない
# action は検査されないまま通る。それでも呼び出し側を壊す変更は捕まるため、hook
# (.lefthook.yaml) は action 側だけの変更でも本ターゲットを発火させる。
.PHONY: actionlint ## .github/workflows のワークフロー定義を actionlint で検査

WORKFLOW_DIR := .github/workflows

actionlint:
	@command -v actionlint >/dev/null 2>&1 || { echo "❌ actionlint が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@if [ ! -d "$(WORKFLOW_DIR)" ]; then \
		echo "🟡 $(WORKFLOW_DIR) が存在しないため検査をスキップします。"; \
	else \
		echo "🔍 Linting GitHub Actions workflows..."; \
		actionlint && echo "✅ actionlint passed."; \
	fi

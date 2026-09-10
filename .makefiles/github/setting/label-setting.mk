## GHのラベルを操作する
.PHONY: labels-create-default ## .github/settings/labels.json に基づいてラベルを作成
.PHONY: labels-delete-all ## すべてのラベルを削除（既存ラベル含む）

# 宣言の解釈と、宣言と実在の差分は scripts/github-settings/labels.ts が持つ。
GITHUB_SETTINGS := pnpm exec tsx scripts/github-settings

labels-delete-all:
	@$(GITHUB_SETTINGS) delete-all

labels-create-default:
	@$(GITHUB_SETTINGS) create

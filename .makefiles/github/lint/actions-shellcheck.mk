## composite action の run シェルの Lint
# actionlint が届かない範囲を埋める。走査対象は .github/actions/** の action.yaml で、
# workflow 側の run: は actionlint が受け持つ。shellcheck の PATH 確認は
# 検査ツール自身が持つ。shellcheck が無ければ検査範囲が黙って縮むため、ここは
# 「無ければ落ちる」側に振る (actionlint は同じ状況で黙ってシェル検査を飛ばす)。
.PHONY: actions-shellcheck ## composite action の run: シェルを shellcheck で検査

ACTIONS_SHELLCHECK := pnpm exec tsx scripts/actions-shellcheck

actions-shellcheck:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@$(ACTIONS_SHELLCHECK)

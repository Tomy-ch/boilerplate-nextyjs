## mise 管理ツールの供給網 cooldown
.PHONY: tools-cooldown-check ## base から動いた mise.toml の pin が冷却期間を満たすか検査する（違反で落ちる）
.PHONY: tools-cooldown-audit ## mise.toml の全 pin を冷却期間に照らして棚卸しする（免除の無い窓の内側で落ちる）

# 窓は配布経路ごとに持つ（scripts/tools-cooldown/README.md）。GitHub Releases は Actions の pin と
# 配布経路が同じなので、同じ変数を読む。言語ランタイム（core:）は窓の対象外なので変数を持たない。
TOOLS_COOLDOWN_RELEASE_DAYS ?= $(ACTIONS_PIN_MIN_AGE_DAYS)
TOOLS_COOLDOWN_REGISTRY_DAYS ?= 7

# check が差分を取る base。recipe 行へ展開せず環境変数として渡す（.makefiles/README.md）。
TOOLS_COOLDOWN_BASE ?=
export TOOLS_COOLDOWN_BASE

TOOLS_COOLDOWN := pnpm exec tsx scripts/tools-cooldown
TOOLS_COOLDOWN_WINDOWS := --release-days $(TOOLS_COOLDOWN_RELEASE_DAYS) --registry-days $(TOOLS_COOLDOWN_REGISTRY_DAYS)

# GITHUB_TOKEN は未認証の GitHub API の枠が 1 回の実行に足りないため。手元では gh の token を借りる。
tools-cooldown-check:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@GITHUB_TOKEN="$${GITHUB_TOKEN:-$$(gh auth token 2>/dev/null)}" $(TOOLS_COOLDOWN) check $(TOOLS_COOLDOWN_WINDOWS)

tools-cooldown-audit:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@GITHUB_TOKEN="$${GITHUB_TOKEN:-$$(gh auth token 2>/dev/null)}" $(TOOLS_COOLDOWN) audit $(TOOLS_COOLDOWN_WINDOWS)

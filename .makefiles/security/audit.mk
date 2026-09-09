## 依存監査ゲート（pnpm audit）
.PHONY: audit ## 修正版のある high / critical の依存脆弱性でゲートする

# 閾値は severity と修正可能性の 2 つ。到達可能性の
# フィルタは pnpm audit にも osv-scanner の call analysis（JS/TS 非対応）にも無く、現行ツールで
# 引ける最も細い線がこの 2 つになる。
# 判定と表の組み立ては scripts/audit-gate が持つ。ここはその入口。
audit:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@pnpm exec tsx scripts/audit-gate

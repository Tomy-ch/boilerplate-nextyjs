## 抑止の撤回条件の棚卸し
.PHONY: suppression-expiry ## 抑止の撤回条件を突き合わせ、満たしたものがあれば落ちる

# 抑止に条件を書く運用と、見る機構が要る理由は docs/adr/0110-security-operations.md 3.4 が持つ。
#
# 週に一度 CI が回す（.github/workflows/suppression-expiry.yaml）。手元でも同じ入口で引ける。
# SUPPRESSION_REPORT を渡すと、一覧を Markdown で書き出す。
SUPPRESSION_REPORT ?=

suppression-expiry:
	@pnpm exec tsx scripts/suppression-expiry $(if $(SUPPRESSION_REPORT),--report "$(SUPPRESSION_REPORT)")

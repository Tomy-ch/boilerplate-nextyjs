## 抑止の撤回条件の棚卸し
.PHONY: suppression-expiry ## 抑止の撤回条件を突き合わせ、満たしたものがあれば落ちる

# 抑止に条件を書く運用と、見る機構が要る理由は [README](../README.md) が挙げる決定が持つ。
#
# 週に一度 CI が回す（.github/workflows/suppression-expiry.yaml）。手元でも同じ入口で引ける。
# SUPPRESSION_REPORT を渡すと、issue の本文を書き出す。
#
# recipe 行へ展開せず、環境変数として渡す（理由は .makefiles/README.md の「外から来る値を
# make の変数として recipe 行へ展開しない」）。受け取る側は process.env から読む。
SUPPRESSION_REPORT ?=
export SUPPRESSION_REPORT

suppression-expiry:
	@pnpm exec tsx scripts/suppression-expiry

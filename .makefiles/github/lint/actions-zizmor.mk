## GitHub Actions 定義の静的解析（zizmor）
.PHONY: actions-zizmor ## workflows / composite action の定義を zizmor で静的解析する（high で落とす）

# actionlint / actions-shellcheck が原理的に見られない観点を担う
# （何が見えないのか、なぜ別の検査が要るのかは [README](../../README.md)）。

# 走査対象は `.`。zizmor が workflows と composite action の両方を集める。
ZIZMOR_TARGET := .

# 設定は明示的に渡す。自動探索が外れても「所見ゼロ」ではなく「抑止が効かない」形で現れるため、
# 外れたことに気付けない。
ZIZMOR_CONFIG := .github/zizmor.yml

# -q: ファイルごとの INFO 行を落とし、所見だけを残す。
ZIZMOR_FLAGS := -q --no-progress --format plain --config $(ZIZMOR_CONFIG)

# ゲートに使う severity。`--min-severity` は表示も絞るので、これを付けた実行だけでは medium 以下が
# 出力からも消える —— 抑止を severity の引き下げで行っている以上（.github/zizmor.yml）、引き下げた
# 所見まで見えなくなると「黙って素通り」になる（[README](../../README.md)）。そのため下のレシピは、
# 全所見を出す実行と、high だけで落とす実行の 2 段に分ける。
ZIZMOR_GATE_SEVERITY := high

# --offline: hook と CI が同じ答えを返すようにする（0153「hooks mirror CI」）。tag 付け替えの検知は
# actions-pin の resolve が fail-closed で担う。
actions-zizmor:
	@command -v zizmor >/dev/null 2>&1 || { echo "❌ zizmor が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@zizmor $(ZIZMOR_FLAGS) --offline $(ZIZMOR_TARGET) || true
	@zizmor $(ZIZMOR_FLAGS) --offline --min-severity $(ZIZMOR_GATE_SEVERITY) $(ZIZMOR_TARGET) >/dev/null

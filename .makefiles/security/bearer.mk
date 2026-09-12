## データフロー検査（Bearer）
.PHONY: bearer-scan ## 値がプロセスの外へ出る地点を、その値の分類と併せて見る

# Bearer は「値がプロセスの外（log 行 / 外向き要求 / 第三者クライアント）へ出る地点」を、その値が
# 何かの分類と併せて報告する。opengrep はパターンや taint 経路をそれ自体の条件で判定
# するだけで、**logger へ届いた文字列がメールアドレスであること**は知らない。
#
# **落とさない。** 誤検知の傾向が強く、ここを fail-closed にすると規則ごとの無効化へ寄っていく。
# 所見は code scanning へ送り、その変更が新しく持ち込んだものだけを GitHub 側の差分チェックが
# 赤にする。
#
# 除外は 2 つだけで、どちらも「秘密ではないと分かっている値」である。パスは走査の起点からの相対。
# **個別の誤検知は `bearer.ignore` がフィンガープリントで受ける**（同 ADR 3.4）—— パスで外すと、
# そのファイルに後から入る本物の所見まで消える。
BEARER_SKIP := config/environment.fixture.ts,adapters/server/auth/development-token.ts

bearer-scan:
	@command -v bearer >/dev/null 2>&1 || { echo "❌ bearer が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@bearer scan src --exit-code 0 --skip-path '$(BEARER_SKIP)' $(BEARER_ARGS)

.PHONY: bearer-sarif ## 同じ検査を SARIF で書き出す（code scanning への取り込み用）

# 取り込み用。**所見が 0 件のとき `bearer` は `results` を `null` で書く**が SARIF にその値は無く、
# 取り込みが弾かれると「所見が無い」と「報告できていない」が見分けられない。scripts/sarif が整える。
BEARER_SARIF_FILE ?= bearer.sarif

bearer-sarif:
	@$(MAKE) bearer-scan BEARER_ARGS="--format sarif --output $(BEARER_SARIF_FILE)"
	@pnpm exec tsx scripts/sarif $(BEARER_SARIF_FILE)

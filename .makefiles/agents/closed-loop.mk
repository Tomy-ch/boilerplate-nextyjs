## 開発の窓の観測コマンド群
#
# 打刻は .agents/closed-loop/marks.sh が hook / スキル / git フックから行う。ここは読む側。
# 決定的な集計だけで、モデルは使わない（[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 2）。

.PHONY: closed-loop-report ## 打刻された開発の窓の段の区間と所見を報告する

closed-loop-report:
	@pnpm exec tsx scripts/closed-loop

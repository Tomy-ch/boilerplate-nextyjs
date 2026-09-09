## 開発の窓の観測コマンド群
#
# 打刻は .agents/closed-loop/marks.sh が hook / スキル / git フックから行う。ここは読む側。
# 決定的な集計だけで、モデルは使わない 決定 2）。

.PHONY: closed-loop-report ## 打刻された開発の窓の段の区間と所見を報告する
.PHONY: closed-loop-send ## 閉じた窓の所見を issue トラッカーへ送出する
.PHONY: closed-loop-send-dry ## 送出する内容だけを出す（何も送らない）
.PHONY: closed-loop-weekly ## 期間ぶんの所見を束ね、着地した改善を測り直す
.PHONY: closed-loop-weekly-consolidate ## 同じことをした上で、関心へ畳む（issue を作って大元を閉じる）

closed-loop-report:
	@pnpm exec tsx scripts/closed-loop

# 送出先は .git の remote から導く。設定項目で宛先を持たない（同 決定 4）。
closed-loop-send:
	@pnpm exec tsx scripts/closed-loop/send

closed-loop-send-dry:
	@pnpm exec tsx scripts/closed-loop/send --dry-run

# 再計測を省略した時点でこの決定は無効になる（同 決定 1）。
closed-loop-weekly:
	@pnpm exec tsx scripts/closed-loop/weekly $(ARGS)

closed-loop-weekly-consolidate:
	@pnpm exec tsx scripts/closed-loop/weekly --consolidate $(ARGS)

## エージェント向けの静音実行
#
# 何のための機構かと、包んではいけない 2 種類のターゲットは .makefiles/README.md が持つ。
#
# 接頭辞であって接尾辞ではない。`%-ai` にすると、基底が既にパターンルールのターゲットのとき
# 一致先が二つに割れる。どちらが勝つかは競合ルールの前提条件が満たせるかで変わり、外れたほうは
# 失敗せず黙って別のことをする。`ai-%` なら他のパターンのリテラル接頭辞と一致しない。

# 置き場所は gitignore 済みの tmp/ 配下。worktree ごとに独立するので窓を跨いだ衝突もない。
AI_LOG_DIR ?= tmp/ai-logs

.PHONY: clean-ai-logs ## エージェント用ログ（tmp/ai-logs）を削除する

# `make ai-<target>` で <target> を静かに実行する。ターゲット名は `ai-` で始めない
# （明示ルールがパターンルールより優先されるので壊れはしないが、読み手が迷う）。
ai-%:
	@mkdir -p $(AI_LOG_DIR)
	@$(MAKE) --no-print-directory $* >$(AI_LOG_DIR)/$*.txt 2>&1; \
	status=$$?; \
	if [ $$status -ne 0 ]; then \
		echo "$(AI_LOG_DIR)/$*.txt を読んでください（make $* が exit $$status で失敗）"; \
	fi; \
	exit $$status

clean-ai-logs:
	@rm -rf $(AI_LOG_DIR)

# ホストの余力に応じてローカルゲートを回すか CI へ委ねるかを決める。
#
# 帯の解決を recipe の中に置くのは、$(shell ...) だとどのターゲットを叩いても走るため。

.PHONY: load-status ## ローカルゲートの負荷帯と 1 窓あたりの CPU 配分を表示する
load-status:
	@pnpm exec tsx scripts/load-band status

# $(1) = 表示名 / $(2) = 委ねる先の CI ワークフロー / $(3) = 実行するコマンド
define run-unless-ci-first
	eval "$$(pnpm exec tsx scripts/load-band env)"; \
	if [ "$$LOAD_BAND" = "ci-first" ]; then \
		echo "⏭  $(1) を CI へ委ねました（$(2)）"; \
		echo "   $$LOAD_REASON"; \
	else \
		$(3); \
	fi
endef

.PHONY: gate-typecheck ## 帯が ci-first でなければ型チェックを実行する
gate-typecheck:
	@$(call run-unless-ci-first,型チェック,typecheck.yaml,pnpm typecheck)

.PHONY: gate-test-full ## 帯が ci-first でなければアプリのテストをカバレッジ付きで実行する
gate-test-full:
	@$(call run-unless-ci-first,アプリのテスト,test.yaml,$(MAKE) test-full)

.PHONY: gate-scripts-test ## 帯が ci-first でなければ補助スクリプトのテストを実行する
gate-scripts-test:
	@$(call run-unless-ci-first,補助スクリプトのテスト,scripts-check.yaml,$(MAKE) scripts-test)

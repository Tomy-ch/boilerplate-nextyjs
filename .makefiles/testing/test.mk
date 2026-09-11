## テスト
#
# 失敗だけを読みたいときは `make test-failures`。**`$(TEST_REPORT_JSON)` を直接読まないこと** ——
# あれは通過したケースも全件・フルパス・メタつきで書くので、実測で素のテキスト出力の 1,100 倍
# (690B に対して 785KB) ある。読むのは `scripts/test-report` だけにする。
#
# 人間向けの reporter は `dot` を採る。**通過を捨てるのはテキストの濾過ではなく reporter の選択で
# 行う** —— 失敗行を語彙で拾う形は、失敗の理由そのものを通過行として捨てうる
# ([0157](../../docs/adr/0157-inspection-declaration-discipline.md))。`dot` は vitest 自身が
# 通過を 1 文字へ畳む出口で、失敗の理由もカバレッジ表もそのまま残る (実測で確認)。
#
# **これでログの大きさが通過件数に比例しなくなる。** 2,703 件の suite で 15,420B → 7,626B、行数は
# 38 行。`tail -n 400` が全文を覆うので、フォールバックが部分読みでなくなる。
TEST_REPORT_JSON := tmp/test-report.json
TEST_LOG := tmp/test.log
TEST_REPORTERS := --reporter=dot --reporter=json --outputFile=$(TEST_REPORT_JSON)

.PHONY: test-full ## カバレッジを測定し、100% のしきい値を検証する
test-full:
	pnpm test $(TEST_REPORTERS)

.PHONY: test-cached ## Vitest のキャッシュを利用してテストを高速に実行する
test-cached:
	pnpm test:cached

## 分割実行
#
# 1 台で全量を走らせる `test-full` と同じものを、台数で割って走らせる。判定に要るのは
# **合流させた結果**なので、各台は blob を書き出すだけで閾値を持たない (vitest.config.ts の
# `VITEST_SHARDED`)。合流する側が閾値を掛ける。
#
# 割るのは PR の待ち時間のためだけである。保護ブランチと手元は `test-full` のまま —— 台数を
# 増やすほど固定費 (準備・依存の取得) が台数ぶん重複するので、誰も待っていない実行で払う理由が
# 無い。
# blob の置き場。既定の `.vitest-reports` を使わないのは、**ドットで始まる名前を
# upload-artifact の glob が拾わない**ため。台が書いても成果物が空で上がり、束ねる側は
# 「1 台も届いていない」としか言えなくなる。追跡しない置き場は tmp に揃える。
TEST_BLOB_DIR := tmp/test-blob

# 合流した結果を構造で書き出す先。報告は失敗だけを出すので、失敗行を語彙で拾う要約器ではなく
# vitest 自身が分けた出口（`status` / `failureMessages`）を読む（ADR 0157）。組み立ては
# `scripts/test-report`。

.PHONY: test-shard ## 分割の 1 台ぶんを走らせ、blob を書き出す (SHARD=<i>/<n>)
test-shard:
	@test -n "$(SHARD)" || { echo "❌ SHARD=<i>/<n> を渡してください。例: make test-shard SHARD=1/4"; exit 1; }
	@VITEST_SHARDED=1 pnpm exec vitest run --coverage --no-cache --shard=$(SHARD) \
		--reporter=blob --outputFile=$(TEST_BLOB_DIR)/blob-$(subst /,-,$(SHARD)).json

# 束ねる前に落とす。足りないまま束ねると、走らなかったテストがカバレッジの不足として現れ、
# 原因を取り違える。台数は各台が書いた名前から読み戻すので、ここでは宣言しない
# (`scripts/lib/shard-completeness.ts`)。
.PHONY: test-shards-verify ## 分割の結果が全台ぶん届いているかを確かめる (合流の前)
test-shards-verify:
	@pnpm exec tsx scripts/test-shards verify $(TEST_BLOB_DIR)

.PHONY: test-merge ## 分割の blob を合流させ、カバレッジのしきい値を検証する
test-merge:
	@pnpm exec vitest run --mergeReports=$(TEST_BLOB_DIR) --coverage $(TEST_REPORTERS)

# 走らせた結果から、落ちたケースだけを出す。通過したケースは 1 行も出ない。
#
# **どこを走らせるかは `TEST_RUN` で差し替える。** 手元は `test-full`、CI の合流側は `test-merge` で、
# 報告の組み立ては 1 か所しか無い。終了コードは走らせた側のものをそのまま返す。
#
# カバレッジの閾値割れは JSON に載らないので、テストが 0 件落ちているのに失敗しているときだけ
# 末尾のログを添える。分岐は構造化された値だけで決まり、ログの語彙は読まない (ADR 0157)。
TEST_RUN ?= test-full

.PHONY: test-failures ## テストを走らせ、失敗したケースだけを出す (TEST_RUN=test-merge で合流側)
test-failures:
	@$(MAKE) --no-print-directory $(TEST_RUN) > $(TEST_LOG) 2>&1; status=$$?; \
		tail -n 400 $(TEST_LOG) > $(TEST_LOG).tail; \
		pnpm exec tsx scripts/test-report $(TEST_REPORT_JSON) $(TEST_LOG).tail /dev/stdout; \
		exit $$status

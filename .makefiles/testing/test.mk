## テスト
.PHONY: test-full ## カバレッジを測定し、100% のしきい値を検証する
test-full:
	pnpm test

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
TEST_REPORT_JSON := tmp/test-report.json

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
	@pnpm exec vitest run --mergeReports=$(TEST_BLOB_DIR) --coverage \
		--reporter=default --reporter=json --outputFile=$(TEST_REPORT_JSON)

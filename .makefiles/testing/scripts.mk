## 補助スクリプトのテスト
#
# アプリ本体の test-full / test-cached とは別立てにする。scripts/ に居るのは lint と
# 1:1 ゲートそのもので、壊れると「違反なし」を報告する向きに倒れる。落ちたときに
# アプリの退行と読み違えないよう、実行も CI のジョブも分ける。
.PHONY: scripts-test ## 補助スクリプトのテストをカバレッジ付き・キャッシュ無効で実行する
scripts-test:
	pnpm test:scripts

.PHONY: scripts-test-cached ## 補助スクリプトのテストを Vitest のキャッシュを利用して実行する
scripts-test-cached:
	pnpm test:scripts:cached

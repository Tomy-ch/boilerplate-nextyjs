## 単体シェルスクリプトの Lint
#
# 走査対象は追跡下の `*.sh` 全数。composite action に埋め込まれた run: は
# actions-shellcheck が、workflow 側の run: は actionlint が受け持つ。
#
# ここに掛かるのは、依存の導入前に走る必要があってシェルで書くしかないもの
# である。TypeScript ではないので 1:1 ゲートもカバレッジも掛からず、
# 静的検査だけが唯一の網になる。shellcheck が無ければ範囲が黙って縮むため落とす。
.PHONY: shellcheck ## 追跡下の *.sh を shellcheck で検査

shellcheck:
	@command -v shellcheck >/dev/null 2>&1 || { echo "❌ shellcheck が PATH にありません。make install-tools を実行してください。"; exit 1; }
	@files=$$(git ls-files '*.sh'); \
	if [ -z "$$files" ]; then \
		echo "🟡 検査対象の .sh がありません。"; \
	else \
		echo "$$files" | xargs shellcheck --shell=bash --external-sources && \
		echo "✅ $$(echo "$$files" | wc -l | tr -d ' ') 件のシェルスクリプトを検査しました。"; \
	fi

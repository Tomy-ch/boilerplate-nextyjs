## 走っているアプリへの検査（OWASP ZAP）
.PHONY: dast ## 走っているアプリへ HTTP を撃ち、配信面を検査する

# ここだけが**ファイルではなく応答**を読む。CSP と
# 同伴ヘッダが 0111 の宣言どおりに配信されているかは、成果物を読んでも分からない。
#
# baseline（受動）を採り、api-scan は採らない。このリポジトリは表示層で API は別リポジトリが
# 持つため、OpenAPI 駆動の走査は撃つ先が実質無い。
#
# 撃つ相手は呼び出し側が決める。CI はランナー内で起動したアプリを、手元では `pnpm start` した
# ものを指す。既定がコンテナから見たホストなのは、走るのがコンテナの中だからである。
#
# パスはすべてマウント点（/zap/wrk = リポジトリ直下）からの相対で、cwd では動かない。ZAP が
# 組み立てる automation plan の出力先も同じくツール側が決めており、そちらは .gitignore で受ける。
DAST_TARGET ?= http://host.docker.internal:3000
DAST_RULES := .github/zap/rules.tsv
DAST_REPORT_DIR := tmp/dast

# 抑止は $(DAST_RULES) が持つ。**そこに並んでいない所見はゲートを赤にする。** ZAP は IGNORE に
# した規則も件数と規則名を出力に残すので、これは黙殺ではなく severity の引き下げにあたる
# （0110 3.4 の「引き下げた所見が出力に残っていること」）。
dast:
	@command -v docker >/dev/null 2>&1 || { echo "❌ docker が PATH にありません。"; exit 1; }
	@mkdir -p $(DAST_REPORT_DIR)
	@docker compose -f docker-compose.dev-tools.yml run --rm -T zap \
		zap-baseline.py -t "$(DAST_TARGET)" -c $(DAST_RULES) \
		-J $(DAST_REPORT_DIR)/zap.json -r $(DAST_REPORT_DIR)/zap.html

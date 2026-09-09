## 依存脆弱性スキャン（OSV）
.PHONY: osv-scan ## 依存ライブラリの脆弱性を OSV データベースで見る（報告専用）
.PHONY: osv-scan-release ## 昇格前に OSV の HIGH 以上でゲートする

# Trivy とも pnpm audit とも参照するデータベースが違う。件数は一致せず、突合して差分を潰そうと
# しない —— 和集合を正とし、どれか 1 つでも閾値に達したものを blocking として扱う
#。
#
# 抑止は osv-scanner.toml が持つ。理由と撤回条件を各エントリへ書く様式は他のスキャナと同じ。
OSV_FLAGS := --lockfile pnpm-lock.yaml --config osv-scanner.toml

# 報告専用の走査が、検出を exit code で伝えるかどうか。既定の 0 は「伝えない」で、手元で
# `make osv-scan` を叩いたときに落ちない従来の挙動を保つ。CI だけが 1 を渡す —— 検出の有無を
# 知らないと「走らなかった」と「見つかった」が同じ緑になり、PR コメントを出すべきかを決められない。
# **これは報告専用をゲートへ変える設定ではない**。ジョブを落とすかどうかは呼び出し側が決める。
OSV_DETECT_EXIT ?= 0

# 報告専用。Trivy の報告側と同じ理由で落とさない（3.1）。
# osv-scanner は検出で 1、それ以外の異常で 1 以外の非ゼロを返す。呼び出し側が 3 つを区別できる
# よう、伝えるときは潰さずそのまま返す。
osv-scan:
	@command -v osv-scanner >/dev/null 2>&1 || { echo "❌ osv-scanner が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@osv-scanner scan source $(OSV_FLAGS); code=$$?; if [ "$(OSV_DETECT_EXIT)" = "1" ]; then exit $$code; fi; exit 0

# 昇格（保護ブランチ宛 PR）の一点だけがゲート。osv-scanner は検出があれば非ゼロで終わるので、
# severity の閾値はここでは持たない —— 範囲は Trivy の昇格ゲートと揃えてある。
osv-scan-release:
	@command -v osv-scanner >/dev/null 2>&1 || { echo "❌ osv-scanner が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@osv-scanner scan source $(OSV_FLAGS)

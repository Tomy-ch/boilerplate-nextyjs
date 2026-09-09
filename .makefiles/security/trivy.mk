## 依存脆弱性スキャン（Trivy）
.PHONY: trivy-fs ## 依存ライブラリの脆弱性を Trivy fs でスキャンする（報告専用）
.PHONY: trivy-fs-release ## 昇格前の依存脆弱性を Trivy fs で厳格にスキャンする（検出で落ちる）

# node_modules は pnpm-lock.yaml と同じ依存を二重計上するため除外する。
# .claude/worktrees は git worktree の実体であり、別ブランチの依存を本体の結果に混ぜないため除外する
# （trivy は .gitignore を見ないので、ignore 済みでも指定しないと走査される）。
# --skip-version-check: trivy 自身の更新確認の通信を止める（版は mise.toml が SSOT）。
TRIVY_SKIP_FLAGS := --skip-dirs node_modules --skip-dirs .claude/worktrees --skip-version-check

# 報告専用の走査が、検出を exit code で伝えるかどうか。既定の 0 は「伝えない」で、手元で
# `make trivy-fs` を叩いたときに落ちない従来の挙動を保つ。CI だけが 1 を渡す —— 検出の有無を
# 知らないと「走らなかった」と「見つかった」が同じ緑になり、PR コメントを出すべきかを決められない。
# **これは報告専用をゲートへ変える設定ではない**。ジョブを落とすかどうかは呼び出し側が決める。
TRIVY_FS_DETECT_EXIT ?= 0

# 報告専用（exit code では落とさない）。脆弱性は「その変更の作者がその場で解消できない」うえ、
# 変更と無関係に時間で状態が変わるため、変更を対象とするゲートには載せられない。
# 止めるのは昇格（保護ブランチ宛 PR）の一点で、そこが CI 側の責務になる
# （判断の全文は [README](../README.md) が挙げる決定）。
# --ignore-unfixed: 修正版のある脆弱性だけを報告する。
# .trivyignore.yaml は自動検出に頼らず --ignorefile で明示し、抑止の適用先を本ターゲットに閉じる。
trivy-fs:
	@command -v trivy >/dev/null 2>&1 || { echo "❌ trivy が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@trivy fs --scanners vuln --pkg-types library --severity CRITICAL,HIGH,MEDIUM --ignore-unfixed --exit-code $(TRIVY_FS_DETECT_EXIT) --ignorefile .trivyignore.yaml $(TRIVY_SKIP_FLAGS) .

# 昇格（保護ブランチ宛 PR）の一点だけがゲートになる。
# 上の報告専用との差分は --ignore-unfixed を外すことだけで、severity の範囲は同じ。修正版の無い
# 脆弱性は「その場で直せない」が、昇格は誰かがそれを引き受けて判断する場面であり、判断の材料に
# するには可視化されている必要がある。
# --exit-code 1: 検出で落とす。報告専用の側と違い、ここは止めるためにある。
trivy-fs-release:
	@command -v trivy >/dev/null 2>&1 || { echo "❌ trivy が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@trivy fs --scanners vuln --pkg-types library --severity CRITICAL,HIGH,MEDIUM --exit-code 1 --ignorefile .trivyignore.yaml $(TRIVY_SKIP_FLAGS) .

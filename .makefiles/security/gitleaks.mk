## シークレットスキャン（gitleaks）
.PHONY: secret-scan ## push 予定のコミットのシークレットを gitleaks でスキャンする
.PHONY: secret-scan-history ## コミット履歴全体のシークレットを gitleaks でスキャンする

# --redact: 検出値そのものを出力しない（hook / CI のログ経由の二次漏洩を防ぐ）
# --no-color: 非 TTY（lefthook / CI）で ANSI エスケープが化けないようにする
# 検出時は exit 1 で落ちる。秘密混入は fail-closed（docs/adr/0110-security-operations.md）。

# 既定の走査対象は「HEAD から辿れて、どのリモートにも存在しないコミット」= これから push される範囲。
# 作業ツリーを見る dir モードを使わないのは、それが守りたい境界とずれているため:
#   - commit した後に作業ツリーから消した秘密を取りこぼす（blob は履歴に残り push される）
#   - push されない gitignore 済みファイル（env/.env.local 等）を誤検知し、hook の bypass 常用を招く
# リモート追跡参照が 1 つも無い状態（一度も fetch / push していないリポジトリ等）では履歴全体が対象になる。
# 対象が広がる方向であり、取りこぼす方向ではない。
#
# CI は SECRET_SCAN_LOG_OPTS で範囲を差し替える。既定のままでは CI で何も走査しない —— PR の
# ブランチは origin に存在するため「どのリモートにも無いコミット」が 0 件になり、走査対象が空の
# まま緑を返す。hook と CI が同じターゲットを呼ぶ（0110）ことと、両者で走査範囲の決まり方が
# 違うことは両立する。差し替えは make の展開へ渡さず環境変数のままシェルで受ける（値は呼び出し側の
# 宣言由来であり、レシピ行へ埋めればその中身がシェルの解釈対象になる。0153 §3 と同じ扱い）。
secret-scan:
	@command -v gitleaks >/dev/null 2>&1 || { echo "❌ gitleaks が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@gitleaks git . --no-banner --redact --no-color --log-opts="$${SECRET_SCAN_LOG_OPTS:-HEAD --not --remotes}"

# 履歴全体。マージ済みの履歴に埋もれた秘密を拾う用途で、走査時間がコミット数に比例して伸びるため
# hook には載せず CI の定期実行だけが呼ぶ（0110 / 撤回条件 W4）。
secret-scan-history:
	@command -v gitleaks >/dev/null 2>&1 || { echo "❌ gitleaks が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@gitleaks git . --no-banner --redact --no-color

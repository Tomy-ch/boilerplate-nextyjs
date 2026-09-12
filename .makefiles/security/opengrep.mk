## portable な SAST（opengrep）
.PHONY: sast ## 自分が書いたコードの脆弱なパターンを opengrep で検査する
.PHONY: sast-sarif ## 同じ検査を SARIF で書き出す（code scanning への取り込み用）

# 依存スキャナが「引き込んだライブラリが既知の脆弱性を持つか」を問うのに対し、こちらは
# 「自分が書いたコードが脆弱なパターンを含むか」を問う。
#
# Semgrep 本体ではなく OSS fork の opengrep を使う。ルール記法は互換で、抑止も
# `// nosemgrep: <rule-id>` がそのまま効く。SAST はリポジトリと一緒に持ち出せる実体で持つ。
#
# **検査条件は 1 箇所に持つ。** ゲート（text）と code scanning への取り込み（SARIF）は
# 同じ対象・同じルール・同じ除外でなければ、落ちた内容と Security タブの一覧が食い違う。
# 変数へ括り出してあるのはそれを構造的に保証するためで、両方の行に書き写さない。

# ルールセット。**レジストリ（semgrep.dev）は引かず**、opengrep-rules を commit で固定して読む。
# 理由と取り出し方は .github/workflows/README.md の「SAST のルールをレジストリから引かない」が
# 持つ。取得と照合は scripts/opengrep-rules が担い、置き場・選別・digest の宣言もそちらが持つ。
OPENGREP_RULES_DIR := tmp/opengrep-rules
OPENGREP_CONFIGS := --config $(OPENGREP_RULES_DIR)

# **走査より先に必ず通す。** ルールが無いまま走ると「所見 0 件」を返し、検査していないことと
# 違反が無いことが見分けられなくなる。
.PHONY: opengrep-rules ## SAST のルールを固定した commit から取り出す（sast の前段）
opengrep-rules:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@pnpm exec tsx scripts/opengrep-rules

# 手で書いたソースだけを対象にする。生成物（src/adapters/gen / mocks/api）を外すのは、
# 編集できないものの所見が行動につながらないため。所見が出るなら直す先は契約か生成器である。
OPENGREP_TARGETS := src scripts tokens mocks e2e vrt docs-viewer .storybook
OPENGREP_EXCLUDES := --exclude node_modules --exclude dist --exclude coverage \
	--exclude src/adapters/gen --exclude mocks/api

# --taint-intrafile: ファイル内の taint 追跡を有効にする。パターン一致だけでは、値の出所が
# 別の行にある形を拾えない。
OPENGREP_FLAGS := $(OPENGREP_CONFIGS) --taint-intrafile $(OPENGREP_EXCLUDES)

# --error: 所見があれば exit 1。**baseline が 0 件であることがこのゲートの前提**で、
# 0 件だからこそ新しい所見が読み飛ばす対象ではなく信号になる。許容する所見はソースへ
# `// nosemgrep: <rule-id>` を理由付きで置き、コードの側に判断を残す。
sast: opengrep-rules
	@command -v opengrep >/dev/null 2>&1 || { echo "❌ opengrep が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@opengrep scan $(OPENGREP_FLAGS) --error $(OPENGREP_TARGETS)

# 取り込み用。ここでは落とさない（落とす判断は上の sast が持つ）。
#
# **抑止済みの所見は取り込む前に落とす**（scripts/sarif）。opengrep は `// nosemgrep:` で消した
# 所見を SARIF には残し、GitHub はそれを閉じた alert として扱わない。渡すと冒頭の「検査条件は
# 1 箇所に持つ」が崩れる。
sast-sarif: opengrep-rules
	@command -v opengrep >/dev/null 2>&1 || { echo "❌ opengrep が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@opengrep scan $(OPENGREP_FLAGS) --sarif --output $(SAST_SARIF_FILE) $(OPENGREP_TARGETS)
	@pnpm exec tsx scripts/sarif $(SAST_SARIF_FILE)

# 書き出し先。CI が上書きする。
SAST_SARIF_FILE ?= opengrep.sarif

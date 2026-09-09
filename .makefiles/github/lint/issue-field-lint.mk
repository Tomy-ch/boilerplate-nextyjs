## 実装タスクの issue が必須項目を持っているかの検査
.PHONY: issue-field-lint ## 実装タスクの issue が、テンプレートの必須項目を実際に持っているかを見る

# テンプレートの `required: true` が縛るのは GitHub の Web フォームだけで、
# `gh issue create --body-file` は素通りする。**そしてそれが AI が起票する経路である。**
# 欄が空のまま起票されると、後から台帳を作る側は「決定が散文のみだったのか、書き忘れたのか」を
# 区別できない。
#
# 開いているものだけを見る。閉じた issue を直しても、そこから読む人はもう居ない。
issue-field-lint:
	@pnpm exec tsx scripts/issue-field-lint

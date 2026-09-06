## ドキュメントサイトの配信先を設定する
.PHONY: apply-pages-delivery ## GitHub Pages を Actions 配信にし、配信元ブランチを許可

# 配信を起こすブランチ。`.github/workflows/deploy-docs.yaml` の push トリガと同じ値を指す。
# 片方だけ変えると、job は起動するが environment に弾かれ、step を 1 つも実行せずに落ちる。
PAGES_DELIVERY_BRANCH ?= production

# Pages の設定は 1 つの payload に収まらず、有効化・environment の方針・許可ブランチの 3 つの
# エンドポイントに分かれる。宣言を .github/settings/ の JSON に置く他の設定と違い、ここが値を
# 直接持つのはそのためである。
#
# シェル変数を全角文字の直前で使うときは `$${VAR}` と囲む。囲まないと、シェルが全角文字の先頭バイトを
# 変数名の一部として食い、空に展開したうえで壊れたバイト列を出す。
#
# 3 段とも現状を読んでから書くので、適用済みのリポジトリで実行しても何も変えない。environment への
# PUT を「まだ名指し方式でないとき」に限るのは、この PUT が body に無い項目（レビュアー・待ち時間）を
# 消すためで、既に整っているリポジトリの設定を巻き込まないようにしている。
apply-pages-delivery:
	@set -e; \
	REPO=$$(gh repo view --json name,owner -q '.owner.login + "/" + .name'); \
	BRANCH="$(PAGES_DELIVERY_BRANCH)"; \
	echo "🔧 Pages の配信設定を $$REPO に適用します（配信元: $${BRANCH}）..."; \
	BUILD_TYPE=$$(gh api "repos/$$REPO/pages" -q .build_type 2>/dev/null || echo ""); \
	if [ -z "$$BUILD_TYPE" ]; then \
		gh api --method POST "repos/$$REPO/pages" -f build_type=workflow >/dev/null; \
		echo "  ✅ Pages を有効化しました（ソース: GitHub Actions）"; \
	elif [ "$$BUILD_TYPE" != "workflow" ]; then \
		gh api --method PUT "repos/$$REPO/pages" -f build_type=workflow >/dev/null; \
		echo "  ✅ Pages のソースを GitHub Actions へ切り替えました（前: $${BUILD_TYPE}）"; \
	else \
		echo "  🟡 Pages は既に GitHub Actions 配信です"; \
	fi; \
	CUSTOM=$$(gh api "repos/$$REPO/environments/github-pages" \
		-q .deployment_branch_policy.custom_branch_policies 2>/dev/null || echo ""); \
	if [ "$$CUSTOM" = "true" ]; then \
		echo "  🟡 github-pages environment は既にブランチを名指しする方針です"; \
	else \
		echo '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
			| gh api --method PUT "repos/$$REPO/environments/github-pages" --input - >/dev/null; \
		echo "  ✅ github-pages environment を、ブランチを名指しする方針へ切り替えました"; \
	fi; \
	if gh api "repos/$$REPO/environments/github-pages/deployment-branch-policies" \
		-q '.branch_policies[].name' 2>/dev/null | grep -qx "$$BRANCH"; then \
		echo "  🟡 $$BRANCH は既に許可されています"; \
	else \
		gh api --method POST "repos/$$REPO/environments/github-pages/deployment-branch-policies" \
			-f name="$$BRANCH" -f type=branch >/dev/null; \
		echo "  ✅ $$BRANCH からの配信を許可しました"; \
	fi; \
	echo "✅ Pages の配信設定を適用しました。"; \
	echo "👉 許可ブランチに覚えのないものが残っていたら Settings → Environments → github-pages で消してください。"

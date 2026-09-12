## リポジトリの初期化
.PHONY: setup-repo ## リポジトリの初期化
.PHONY: setup-replace-license-copyright ## LICENSEの著作権表示を更新
.PHONY: setup-replace-repository-reference ## リポジトリ参照とプロジェクト名をテンプレートから作った側へ置換
.PHONY: setup-remove-licensed-scanners ## 資格情報を要するスキャナを撤去
# boilerplate-only:begin
.PHONY: setup-remove-boilerplate-only ## boilerplate 限定の記述を剥がす
# boilerplate-only:end
# sample:begin
.PHONY: setup-remove-sample ## 同梱サンプルを一括破棄し、検証まで実行
# sample:end

# 有効値は 1 のみ（[README](../../README.md)）。$(if) は空文字列判定なので filter で絞る。
SETUP_DRY_RUN_FLAG := $(if $(filter 1,$(DRY_RUN)),--dry-run,)

# 利用者が渡す値はレシピ文字列へ直接展開せず、環境変数としてシェルに渡して
# シェル側で展開する（make が展開した文字列を再解釈させるとコマンド注入を許すため）
export COPYRIGHT_HOLDER
export COPYRIGHT_YEAR
export REPOSITORY
export PORTAL_URL

setup-repo:
	@echo "🔧 設定を確認中..."

	@if git rev-parse --verify refs/tags/v0.0.0 >/dev/null 2>&1; then \
		echo "❌ タグ 【v0.0.0】 があります。初期化を停止します。"; exit 1; \
	fi

	@echo "✅ 初期化を開始します"

	@echo "🔧 ghコマンドのログインを開始します..."
	@make gh-login
	@echo "✅ ghコマンドのログインが完了しました。"

	@echo "🔧 タグの初期化を開始します..."
	@TAGS=$$(git tag); \
	if [ -n "$$TAGS" ]; then \
		for tag in $$TAGS; do \
			git tag -d $$tag; \
			git push origin :refs/tags/$$tag || true; \
		done; \
		echo "🧹 すべてのタグを削除しました。"; \
	else \
		echo "🟡 削除対象のタグが存在しません。"; \
	fi
	@echo "✅ タグの初期化を終了します。"

	@echo "🔧 v0.0.0のタグ打ちを開始します..."
	@git tag -a v0.0.0 -m "Initial boilerplate tag"
	@git push origin v0.0.0
	@echo "✅ v0.0.0のタグ打ちが完了しました。"

	@echo "🔧 ブランチ作成を開始します..."
	@if git show-ref --verify --quiet refs/heads/develop; then \
		echo "🟡 ブランチ 【develop】 は既に存在します。作成処理をスキップします。"; \
	else \
		git branch develop; \
	fi

	@if git show-ref --verify --quiet refs/heads/staging; then \
		echo "🟡 ブランチ 【staging】 は既に存在します。作成処理をスキップします。"; \
	else \
		git branch staging; \
	fi

	@if git show-ref --verify --quiet refs/heads/production; then \
		echo "🟡 ブランチ 【production】 は既に存在します。作成処理をスキップします。"; \
	else \
		git branch production; \
	fi

	@git push origin develop staging production
	@echo "✅ ブランチの作成を終了します。"

	@echo "🔧 デフォルトブランチの設定を開始します..."
	@REPO=$$(gh repo view --json name,owner -q '.owner.login + "/" + .name'); \
		gh api -X PATCH repos/$$REPO -f default_branch=production

	@git fetch --prune
	@ORIGINAL_BRANCH=$$(git branch --show-current); \
	git switch production; \
	if echo $$ORIGINAL_BRANCH | grep -q "release/"; then \
		git branch -D $$ORIGINAL_BRANCH; \
		git push origin --delete $$ORIGINAL_BRANCH || true; \
	fi
	@echo "✅ デフォルトブランチの設定を終了します。"

	@echo "🔧 ルールセットの適用を開始します..."
	@make branch-protection-apply
	@echo "✅ ルールセットの適用を終了します。"

	@echo "🔧 Pages の配信設定を開始します..."
	@make pages-delivery-apply
	@echo "✅ Pages の配信設定を終了します。"

	@echo "🔧 ラベルの初期化を開始します..."
	@make labels-delete-all
	@make labels-create-default
	@echo "✅ ラベルの初期化を終了します。"

	@echo "🔧 リリースノートの初期化を開始します..."
	@if [ -d ".github/release" ]; then \
		find .github/release -type f ! -name "v0.0.0.md" -delete; \
		echo "🧹 v0.0.0.md 以外のリリースノートを削除しました。"; \
	else \
		echo "🟡 .github/release ディレクトリが存在しないためスキップします。"; \
	fi
	@echo "✅ リリースノートの初期化を終了します。"

	@git remote remove upstream || true
	@echo "✅ 初期化が完了しました。デフォルトブランチは production です。"

setup-replace-license-copyright:
	@if [ -z "$$COPYRIGHT_HOLDER" ]; then \
		echo "❌ COPYRIGHT_HOLDER を指定してください。例: make setup-replace-license-copyright COPYRIGHT_HOLDER='Example Inc.' COPYRIGHT_YEAR=2026"; \
		exit 1; \
	fi
	@pnpm exec tsx scripts/setup/replace-license-copyright \
		--holder "$$COPYRIGHT_HOLDER" \
		$${COPYRIGHT_YEAR:+--year "$$COPYRIGHT_YEAR"} \
		$(SETUP_DRY_RUN_FLAG)

setup-replace-repository-reference:
	@if [ -z "$$REPOSITORY" ]; then \
		echo "❌ REPOSITORY を指定してください。例: make setup-replace-repository-reference REPOSITORY='example-org/example-app'"; \
		exit 1; \
	fi
	@pnpm exec tsx scripts/setup/replace-repository-reference \
		--repository "$$REPOSITORY" \
		$${PORTAL_URL:+--portal-url "$$PORTAL_URL"} \
		$(SETUP_DRY_RUN_FLAG)

# 資格情報を要するスキャナ（CodeQL / SonarQube Cloud / Dependency Review）の撤去。
#
# 剥がしと違い、**これは選択である**。3 つが要求するのはライセンス・ベンダーのトークン・
# Dependency graph の有効化で、どれも設定の判断であってコードの判断ではない。決めるまでの間に
# 壊れるものは無い —— 必要なものが無ければ各 workflow は自分を飛ばして緑を返す。
#
# スクリプトは製品ごとに別のコミットへ分ける。後からライセンスを得たら git revert 1 回で戻せる
# ので、作業ツリーはクリーンである必要がある。
setup-remove-licensed-scanners:
	@pnpm exec tsx scripts/setup/remove-licensed-scanners $(SETUP_DRY_RUN_FLAG)

# boilerplate-only:begin
# boilerplate 限定の記述（この template を配る側にしか意味を持たない規則・注記）を剥がす。
#
# サンプル破棄と違い、飛ばす選択肢が無い。テンプレートから作った時点で前提が失効するため、残すと
# 作った側が自分に効かない規則に従うことになる。破棄と同じく、剥がしの道具そのものも消える。
#
# 剥がすのは散文だけなので build / test は連鎖させない。手順の最後の確認でまとめて通す。
setup-remove-boilerplate-only:
	@pnpm exec tsx scripts/setup/remove-boilerplate-only $(SETUP_DRY_RUN_FLAG)
	@if [ -n "$(filter 1,$(DRY_RUN))" ]; then \
		echo "🟡 DRY_RUN のため整形・検査はスキップしました。"; \
	else \
		pnpm fix:md && pnpm lint:md && \
		echo "✅ boilerplate 限定の記述を剥がしました。"; \
	fi
# boilerplate-only:end

# sample:begin
# 同梱サンプル（EC の題材を持つ画面群と、その題材に固有の契約・モック）の破棄。
#
# make は起動時に makefile を全読込するため、手順 1 のスクリプトがこの .mk から自分のターゲットを
# strip（自消滅）しても、実行中のレシピは継続して検証まで走る。
#
# 破棄後の整形・検査・build・test を連鎖させるのは、参照の消し残しがその場で判るのが唯一この
# タイミングだからである。各手順は && で連鎖し、途中の失敗が完了メッセージに隠れない。
# プレビューは DRY_RUN=1 を付ける（破棄も検証も行わない）。
setup-remove-sample:
	@pnpm exec tsx scripts/setup/remove-sample $(SETUP_DRY_RUN_FLAG)
	@if [ -n "$(filter 1,$(DRY_RUN))" ]; then \
		echo "🟡 DRY_RUN のため整形・検査・検証はスキップしました。"; \
	else \
		echo "🔧 整形・検査・build・test を実行します..." && \
		pnpm fix && \
		pnpm lint:ci && \
		pnpm typecheck && \
		pnpm lint:md && \
		APP_ENV=local pnpm build && \
		pnpm test && \
		echo "🔍 過不足と残留参照を検証します..." && \
		pnpm exec tsx scripts/setup/verify-sample-removal && \
		echo "✅ サンプルの破棄・検査・検証が完了しました。"; \
	fi
# sample:end

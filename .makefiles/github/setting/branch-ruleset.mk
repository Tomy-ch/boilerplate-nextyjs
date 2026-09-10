## ブランチ保護ルールを設定する
.PHONY: branch-protection-apply ## .github/settings/branch-protection.json を対象リポジトリにPOST

branch-protection-apply:
	@set -e; \
	REPO=$$(gh repo view --json name,owner -q '.owner.login + "/" + .name'); \
	echo "🔧 $$REPO へブランチルールを適用します..."; \
	RESPONSE=$$(mktemp); \
	if ! gh api \
		--method POST \
		-H "Accept: application/vnd.github+json" \
		-H "X-GitHub-Api-Version: 2022-11-28" \
		/repos/$$REPO/rulesets \
		--input .github/settings/branch-protection.json \
		--verbose \
		> $$RESPONSE 2>&1; then \
			echo ""; \
			echo "❌ gh api が失敗しました。"; \
			echo "------ GitHub API の応答 ------"; \
			cat $$RESPONSE; \
			echo "------------------------------"; \
			echo ""; \
			echo "👉 上のエラーを確認してください。"; \
			echo "👉 API の互換性が原因の場合は、パッケージマネージャで GitHub CLI (gh) を更新してください。"; \
			echo ""; \
			rm -f $$RESPONSE; \
			exit 1; \
	fi; \
	rm -f $$RESPONSE; \
	echo "✅ ブランチルールを $$REPO に適用しました。"

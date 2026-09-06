# Makefile
.DEFAULT_GOAL := help

# GitHub関連
include .makefiles/github/operation/release-branch.mk
include .makefiles/github/operation/release-tag.mk
include .makefiles/github/operation/release-version.mk
include .makefiles/github/setting/github.mk
include .makefiles/github/setting/branch-ruleset.mk
include .makefiles/github/setting/label-setting.mk
include .makefiles/github/lint/actionlint.mk
include .makefiles/github/lint/actions-shellcheck.mk
include .makefiles/github/lint/actions-comment-secret-lint.mk
include .makefiles/github/lint/actions-mise-pin-lint.mk
include .makefiles/github/lint/actions-required-check-lint.mk
include .makefiles/github/lint/actions-zizmor.mk
include .makefiles/github/lint/shellcheck.mk
include .makefiles/github/operation/baseline-store.mk

# ツール関連
include .makefiles/tools/setup.mk
include .makefiles/tools/commitlint.mk
include .makefiles/tools/actions-pin.mk
include .makefiles/tools/images-pin.mk
include .makefiles/tools/egress.mk
include .makefiles/tools/gen-api.mk

# テスト関連
include .makefiles/testing/test.mk
include .makefiles/testing/load-band.mk
include .makefiles/testing/scripts.mk
include .makefiles/testing/vrt.mk
include .makefiles/testing/e2e.mk
include .makefiles/testing/lighthouse.mk
include .makefiles/testing/review.mk

# セキュリティ関連
include .makefiles/security/gitleaks.mk
include .makefiles/security/trivy.mk
include .makefiles/security/audit.mk
include .makefiles/security/opengrep.mk
include .makefiles/security/osv.mk
include .makefiles/security/bearer.mk
include .makefiles/security/dast.mk
include .makefiles/security/suppression.mk

# 一括実行系ファイル
# GitHub関連
include .makefiles/github/operation/setup-repository.mk

.PHONY: help
help:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@pnpm exec tsx scripts/make-help

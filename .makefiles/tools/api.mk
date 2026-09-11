## API 契約の取り込み
.PHONY: api-fetch ## openapi/sources.yaml の座標から契約を取得し blob SHA をスタンプする
.PHONY: api-gen ## 取得済みの契約から型 / zod / MSW ハンドラを生成する
.PHONY: api-gen-check ## 契約と生成物の版が揃っているか検証する (生成なし・CI / hook 用)

# 取得対象の契約名。省略時は sources.yaml の全件を取得する (例: make api-fetch NAME=api)。
NAME ?=

api-fetch:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@command -v gh >/dev/null 2>&1 || { echo "❌ gh が PATH にありません。GitHub CLI をインストールし gh auth login を済ませてください。"; exit 1; }
	@pnpm exec tsx scripts/openapi/fetch-api.ts $(if $(strip $(NAME)),"$(strip $(NAME))")

# 退避・生成・書き戻しは scripts/openapi/gen-api.ts が持つ。生成物の置き場と退避先の宣言も
# 向こう側にあり、失敗したときの終了コードでここが止まる。
#
# 生成の直後に整形まで掛ける。整形を別手順にすると、生成しただけの状態が commit され、
# drift ゲートが「生成し忘れ」ではなく「整形し忘れ」で落ちる。
api-gen:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@pnpm exec tsx scripts/openapi/gen-api.ts
	@pnpm fix >/dev/null
	@echo "✅ 契約から型 / zod / MSW ハンドラを生成しました"

api-gen-check:
	@command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm が PATH にありません。make install-tools を実行し、shell の mise activate を済ませてください。"; exit 1; }
	@pnpm exec tsx scripts/openapi/check-generated.ts

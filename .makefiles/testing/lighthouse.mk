## 画面ごとの Core Web Vitals
#
# `e2e/lib/screens.ts` が宣言する画面を 1 枚ずつ Lighthouse で開き、LCP / CLS / TBT を
# performance-budget.yaml の上限と照らす。
#
# 起動は画面を通した検証 (e2e.mk) をそのまま使う —— 本番ビルドをホストで起動し、終わったら
# 片付ける。同じものを 2 組持つと、起動待ちも後片付けもポートの衝突検査も二重になり、片方だけを
# 直した状態が生まれる。
#
# **ブラウザはコンテナではなくホストで動かす。**撮影 (vrt / e2e) がコンテナを使うのは、基準画像の
# 一意性がフォントのラスタライズに懸かるためである。ここが比べるのは画素ではなく数値なので、
# 固定すべきはブラウザの版であり、それは pnpm-lock.yaml の @playwright/test が全ての機械で固定
# している。一方で判定は TypeScript で書かれており、node_modules を入れた OS 向けに解決される
# esbuild がコンテナの中では動かない。
.PHONY: lighthouse ## 画面ごとの Core Web Vitals を測り、予算と照らす
.PHONY: lighthouse-gate ## 測定を省いてよいかだけを答える (run / skip)
.PHONY: lighthouse-record-verified ## 予算を通った時点の入力のハッシュを記録する
.PHONY: lighthouse-merge ## 分割した台の結果を束ね、予算と照らす
.PHONY: lighthouse-report ## 直前の実行が残した LHR から、動いた要素と重い script を引く

# 分割の 1 台ぶんの指定 (<i>/<n>)。空なら割らない。
#
# **1 台の中で並べる指定ではない。**測っているのは CPU 律速の値なので、同じ機械で計測を並べた
# 時点で互いの CPU を奪い合い、予算と照らす意味が消える。割るのは機械であって中ではない。
#
# 割るのは PR の待ち時間のためだけである。保護ブランチと日次と手元は割らない —— 台数を増やす
# ほど固定費 (準備・依存の取得・ビルド) が重複するので、誰も待っていない実行で払う理由が無い。
#
# 既定は空で `export` するので、割らない実行にも空文字列が届く。受け側はそれを「指定なし」として
# 扱う (scripts/lighthouse/index.ts)。
LIGHTHOUSE_SHARD ?=
export LIGHTHOUSE_SHARD

# 基準画像は要らない。撮るのではなく測るので、置き場が空でも判定は成立する。代わりに、測る
# ブラウザがホストへ入っていることを確かめる (入っていれば何もしない)。
lighthouse: E2E_PRECHECK := pnpm exec playwright install chromium

# 画面を通した検証 (3100) とも開発サーバ (3000) とも別にする。同じポートを使うと、既に何かが
# 待ち受けている環境で「起動を待つ」が他人のサーバへの疎通で満たされ、その相手を測ってしまう。
lighthouse: E2E_PORT := 3300

# 待ち受けは loopback に固定する。画面を通した検証がホストの宛先を docker の bridge から引くのは
# ブラウザがコンテナの中に居るためで、ここはブラウザもホストに居るのでその経路が要らない。
#
# **固定しないと Linux の CI で落ちる。** bridge の gateway (172.17.0.1 等) で待ち受けると、
# テスト専用の session 発行口が見る Host がその IP になり、開ける宛先の集合
# (src/adapters/server/auth/development-access.ts) のどれとも一致せず 404 が返る。役割の要る画面が
# 開けない。**直すときに宛先の集合を広げてはいけない** —— あれは設定を誤って公開したときに被害を
# 手元へ留める線で、広げれば任意の役割の session を発行する口の露出面がそのぶん広がる。
lighthouse: E2E_HOSTNAME := 127.0.0.1

lighthouse: E2E_COMMAND = E2E_BASE_URL=http://$$hostname:$(E2E_PORT) pnpm exec tsx scripts/lighthouse
lighthouse: e2e-run

lighthouse-report:
	@pnpm exec tsx scripts/lighthouse/diagnose
	@echo ""
	@echo "📄 LHR そのものは tmp/lighthouse/<画面名>-<試行>.json にあります。https://googlechrome.github.io/lighthouse/viewer/ へ落とすと全項目を読めます。"

lighthouse-merge:
	@pnpm exec tsx scripts/lighthouse merge

# 予算を通った時点の入力のハッシュ。**撮影側 (vrt.mk) と同じ仕組みで、数える入力だけが違う。**
# 追跡下に置かないのは、これが木の状態ではなく「その木を測った」という実行の履歴であるため。
# CI は cache で持ち回る (.github/workflows/lighthouse.yaml)。
LIGHTHOUSE_VERIFIED_FILE := tmp/lighthouse/verified-inputs.sha256

# 省いたのか測ったのかを機械可読で残す。緑の理由が「測って通った」なのか「前と同じだから
# 測っていない」なのかは、読む人にとって別物である。
LIGHTHOUSE_GATE_MARKER := lighthouse-gate:

# 判定だけを答える。**build より前に答えられる** —— 数える入力は build 生成物ではなく元なので、
# 台を割る前の段 (plan) で 1 度だけ引ける。撮影側が台ごとに引くのは storybook-static を
# 数えているためで、こちらにその制約は無い。
lighthouse-gate:
	@pnpm exec tsx scripts/lighthouse gate $(LIGHTHOUSE_VERIFIED_FILE)

# 記録は予算を通った後にだけ書く。手前で書くと、超えた状態を「通った」として残す。
# **いつ確定させるかは呼ぶ側が決める** —— 割った実行では全台の結果を知っている `lighthouse`
# ジョブ (.github/workflows/lighthouse.yaml)、割らない実行では手元の `make lighthouse` の後。
lighthouse-record-verified:
	@mkdir -p "$$(dirname $(LIGHTHOUSE_VERIFIED_FILE))"
	@pnpm exec tsx scripts/lighthouse inputs > $(LIGHTHOUSE_VERIFIED_FILE)

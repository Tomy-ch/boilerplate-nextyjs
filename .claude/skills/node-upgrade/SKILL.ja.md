> このファイルは `SKILL.md`(canonical / 英語)の日本語参考訳です。スキルとしては読み込まれません(参考用)。

# Node.js バージョンアップ手順

本プロジェクトが使う Node.js バージョンを任意のターゲットへ上げる作業手順を定義する。`mise.toml` の
`[tools] node` が Node ランタイムバージョンの**単一の正**(ADR 0003 /
[0003-version-manager.md](../../../docs/adr/0003-version-manager.md))。

## 位置づけ(`tools-upgrade` との違い)

- **`node-upgrade`(本スキル)** — *意図的・単目的*の Node バージョン移動: Node のリリースノート/破壊的変更を確認し、
  `mise.toml` を上げ、リビルドして検証。Node ライン(例 24.x → 26.x、セキュリティ patch)を明確に変える意図がある時。
- **`tools-upgrade`** — 全 `mise.toml [tools]` エントリ(node **と** pnpm 等)を upstream 最新に対して*定期・一括*監査。
  supply-chain quarantine ゲート付き。単一ランタイムの熟慮アップグレードではなく、定期的なバージョン衛生向け。

重複は「`mise.toml [tools] node` を編集」の一点のみ。Node を動かすと分かっていてリリースノート確認 + フルリビルドが
欲しいなら本スキル。

## 使わないとき

- `pnpm` 等の更新 → `tools-upgrade`(または単発なら `mise.toml` 編集 + `make install-tools`)。
- npm 依存(`package.json` の `dependencies` / `devDependencies`)更新 → ここでは対象外。[0004](../../../docs/adr/0004-library-management.md) に従い
  依存のメジャーは別 PR。

## Step 0. ターゲットバージョンの確認

本スキルは**起動直後に必ず `AskUserQuestion` を呼ぶ**。引数や直近メッセージにバージョンらしき文字列があっても、
黙って採用して進めない(設定ミス防止のため明示確認が必須)。

1. `mise.toml` の `[tools]` 下 `"core:node" = "X.Y.Z"` を読み現行版を把握。**backend の接頭辞は鍵の一部**であり（ADR 0003 が全エントリに要求）、裸の `node =` で探すと見つからない。
2. **必ず** `AskUserQuestion` を呼ぶ:
   - 質問:「アップグレード先の Node.js バージョンを指定してください(例 `26.0.0`)。」
   - 現行版(`mise.toml [tools] node` の値)を文脈として含める。
   - 引数/直近メッセージに候補があれば「候補: `X.Y.Z`」として含める。
3. 回答が `X.Y.Z` 形式か検証。以降 `<TARGET_VERSION>` として使う。

ターゲット確定まではファイル変更もコマンド実行もしない。

## 前提

- ターゲット: `<TARGET_VERSION>`(上で確認した値)。
- `production` / `develop` / `staging` / `release/*` / `hotfix/*` で直接作業しない(AGENTS.md の Git 規約)。
  最新の `release/*` から作業ブランチを作る(例 `feature/node-upgrade-<TARGET_VERSION>`)。

## AI 変更スコープ(スキル宣言)

AGENTS.md「例外: スキル実行」により、通常の AI 変更スコープは**本スキルが宣言したパスに限り**、実行中のみ緩和される。
許可:

- `mise.toml` — `[tools]` 下 `node` エントリ(SSOT 編集。`mise.toml` は本来保護対象のルート設定なので、起動時に
  ユーザが認識できるよう本スキルが明示宣言する)。
- `pnpm-lock.yaml` — ランタイム変更で解決が変わる場合に `pnpm install` が再生成。

本スキル実行中も保護されたまま: `AGENTS.md` / `CLAUDE.md`、Accepted な ADR 本文、`LICENSE`、`package.json` 等の
ルート設定(`@types/node` 変更は**別 PR** ── ステップ 6 参照)、生成ファイル、`.claude/settings.json` の
`permissions.deny` 配下。

## Step 1. リリースノート確認

対象 Node ラインのリリースノートを <https://github.com/nodejs/node/releases>(と Node.js changelog)で確認:

- 削除/非推奨 API・フラグ(特に Next.js 16 / ツールチェーンが依存するもの)。
- V8 バージョンと挙動変化。
- エコシステムの最小バージョン要件(Next.js 16 / React 19 は `<TARGET_VERSION>` をサポートするか)。
- `<TARGET_VERSION>` が LTS か Current か(boilerplate は Active LTS 推奨。ユーザが Current を望む場合を除く)。

メジャー更新なら、進める前に主要な破壊的変更をユーザに提示する。

## Step 2. `mise.toml` 更新

```toml
[tools]
"core:node" = "<TARGET_VERSION>"
"aqua:pnpm/pnpm" = "…"   # 変更なし
```

`mise.toml` が単一の正。本リポジトリで Node の版を持つファイルは他に無く(Dockerfile も無い ──
[0011](../../../docs/adr/0011-no-docker.md))、伝播ステップは存在しない。

## Step 3. ローカル Node 環境の更新(ユーザ作業)

**ユーザ**に `make install-tools`(`mise install` を実行し `[tools] node` を読む)を実行してもらい、バージョンを確認:

```sh
make install-tools
node --version        # v<TARGET_VERSION> であること
```

AI エージェントは `mise install` を自分で実行しない(マシンのツールチェーンを変更するため)── ユーザ作業。

## Step 4. ロックファイル/依存の再構築

ランタイム切替後、ロックファイルを新ランタイム・engine 制約に合わせて再インストール:

```sh
pnpm install          # 解決が変われば pnpm-lock.yaml を更新
```

`pnpm-lock.yaml` の diff を確認(多くは最小/空)。大きな diff は要確認。

## Step 5. 検証

```sh
pnpm lint             # biome check(ADR 0002)
make test-full        # Vitest。カバレッジゲート付き ── 新ランタイムで緑必須
make scripts-test     # scripts/ の suite。同じゲート
pnpm build            # next build ── 新ランタイムで成功必須
```

ランタイム変更が実際に現れるのはテスト suite である。Node のメジャーは `Intl` の出力・タイマー分解能・
`structuredClone` の意味論を動かしうるが、build が通ることはそのどれについても何も言わない。任意で dev サーバ
(`pnpm dev` → 停止)をスモークし、ランタイムでアプリが起動するか確認。

## Step 6. フォローアップの明示(ここでは束ねない)

- **`@types/node`**: `devDependencies` のメジャーを対象ランタイムのメジャーと突き合わせる。揃えるのは
  妥当だが、**[0004](../../../docs/adr/0004-library-management.md)** により依存**メジャー**更新は**別 PR**。推奨フォローアップとして報告し、本スキルでは
  `package.json` を編集しない。
- **CI**: workflow は `.github/actions/setup-mise` でツールチェーンを入れ、版は `mise.toml` から読むので、
  `node-version-file` / matrix の同期対象は無い。

## チェックリスト

- [ ] `<TARGET_VERSION>` を `AskUserQuestion` でユーザ確認
- [ ] リリースノート/破壊的変更を確認、Next.js 16 / React 19 互換を確認
- [ ] `mise.toml [tools] node` を `<TARGET_VERSION>` に更新
- [ ] `make install-tools`(ユーザ作業)で更新、`node --version` 一致
- [ ] `pnpm install` 実行、`pnpm-lock.yaml` diff 確認
- [ ] `pnpm lint` + `make test-full` + `make scripts-test` + `pnpm build` が新ランタイムでグリーン
- [ ] `@types/node` メジャー整合は別 PR として記録(ここでは行わない)

## 注意

- `mise install` を自分で実行しない ── ユーザ作業(Step 3)。
- ここで `package.json` を編集しない(Step 6)。
- 作業ブランチでコミット。保護ブランチへの直接コミット禁止(AGENTS.md)。
- push は明示指示があるときのみ。
- `SKILL.md` 更新後は `SKILL.ja.md` も同期。

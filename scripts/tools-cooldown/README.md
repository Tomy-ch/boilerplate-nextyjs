# tools-cooldown

`mise.toml` の pin が供給網の冷却期間（cooldown）を満たしているかを検査する。手で編集して入れた
pin を止める門であり、`tools-upgrade` スキルを通さない bump もここに掛かる。

## 何を見るか

pin が指す版の**公開日時**を配布経路から引き、今日までの経過日数を経路ごとの窓と比べる。窓は
悪意ある版が公開されてから上流が撤回するまでの時間を稼ぐためのもので、ツールが何を壊しうるか
ではなく**どの経路で配られたか**に比例する。

| 配布経路 | backend | 公開日時の出所 | 窓を渡す変数 |
| --- | --- | --- | --- |
| GitHub Releases | `aqua:` / `ubi:` / `github:` | Release の `published_at`（tag は `v` 付きと無しの両方を試す） | `TOOLS_COOLDOWN_RELEASE_DAYS` |
| 公開レジストリ | `npm:` / `pipx:` / `pypi:` | npm の `time`、PyPI の配布物の upload 時刻（最も早いもの） | `TOOLS_COOLDOWN_REGISTRY_DAYS` |

窓の値は [`.makefiles/security/tools-cooldown.mk`](../../.makefiles/security/tools-cooldown.mk)
が持ち、GitHub Releases は Actions の pin と同じ変数を読む（配布経路が同じで、検知の遅れも揃う）。
**このスクリプトは窓の既定を持たない** —— 経路のどれかに窓が無ければ落ちる。0 日を渡すとその
経路の検疫は切れる。

**上の表に無い backend は「検査できなかった」として落とす**（exit 2）。公開日時を引けない
ことは「古い」ことではない。同じ理由で、上流がその版を知らない・応答を読めない・問い合わせに
失敗した pin も落とす。次の「窓の対象外」だけがこの扱いの外に居る。

## 窓の対象外 —— 言語ランタイム（`core:`）

`core:` backend の pin（node / python / go などの言語ランタイム）は**窓を当てない。受容する
リスクである。**

窓が効くのは、悪意ある版が 1 つのパッケージとして公開され、上流の検知が回って撤回される、という
形の侵害に対してである。言語ランタイムの配布物が汚染される事態はその形をしていない。それは
1 リンクの乗っ取りではなく**言語の信頼モデルそのものの失敗**で、その言語で書かれたあらゆるものが
同時に疑わしくなり、待っても検知が回ってくる保証が無い。窓は自動化された侵害への遅延であって、
この形には効かない。効かない窓で落とすと、pin を上げるたびに理由の無い待ちか免除が要るだけになる。

したがって `core:` の pin は:

- `check` でも `audit` でも**窓では落とさない**
- **棚卸しには載せる**（版と、対象外である旨が読める形で）。除外は決定であって、見えなくする
  ことではない
- **「検査できなかった」（exit 2）にもしない**。除外は「検査しないと決めた」ものであり、公開日時を
  引けなかった pin とは出口が違う。この 2 つを同じ出口へ倒すと、成立していない検査と成立させない
  検査の区別が消える
- 公開日時は**引かない**。判定に使わない値のために問い合わせを増やすと、その失敗を握りつぶす経路が
  1 つ増えるだけになる
- 免除（`tools-cooldown-ignore:`）を付けていれば違反。効かない宣言である

## 2 つの入口

| コマンド | 対象 | いつ |
| --- | --- | --- |
| `make tools-cooldown-check` | `TOOLS_COOLDOWN_BASE` の時点から**動いた pin だけ** | PR。CI は base ブランチを渡す |
| `make tools-cooldown-audit` | 全 pin | 週次。手元でも引ける |

PR で差分だけを見るのは、base から引き継いだ pin をその PR の作者がその場で直せないためである。
引き継いだ状態は週次の棚卸しが見る。棚卸しで落ちるのは、免除の無いまま窓の内側に居る pin
—— 門を赤のまま merge した pin はここで捕まる。

## 免除

窓の内側の版を意図して採るときは、pin の直上のコメント塊に宣言する。

```toml
# 直前の版に脆弱性がある（GHSA-xxxx）。
# tools-cooldown-ignore: 修正版がこの版しか無い。窓が明ける 2026-09-21 に外す。
"aqua:owner/tool" = "1.2.3"
```

- `tools-cooldown-ignore:` の行から塊の末尾までが理由と撤回条件。その上の行は pin の説明として読まない
- **撤回条件は窓が明ける日を `YYYY-MM-DD` で含める。** 免除が要るのは窓の内側に居るあいだだけで、
  明けた日が撤回の日である。日付が無い免除、窓が明ける前に切れる免除は違反
- 窓を満たした pin に免除が残っていれば違反。撤回条件を満たした宣言なので、外す
- 免除は抑止の棚卸し（[`suppression-expiry`](../suppression-expiry/)）にも `<key>@<version>` の名前で
  載り、期限を過ぎれば週次で落ちる

この様式は他の抑止と同じ 3 点（対象・理由・撤去条件）を持ち、置き場は pin の隣で 1 箇所に
まとまる。理由をコメントに書くのは `pnpm-workspace.yaml` の `overrides` /
`minimumReleaseAgeExclude` と同じ形で、pin の宣言そのものが理由を載せる欄を持たないためである。

## 終了コード

| code | 意味 |
| --- | --- |
| 0 | 窓の対象の pin が全て窓を満たす（免除つきを含む）。窓の対象外の pin は数えない |
| 1 | 窓の内側で免除が無い、免除が様式を満たさない、または要らない免除が残っている pin がある |
| 2 | 検査が成立していない —— 公開日時を引けない / backend に経路が無い / base や `mise.toml` を読めない |

## 構造

| ファイル | 責務 |
| --- | --- |
| `index.ts` | 引数と環境の受け取り、`git show` と HTTP、終了コード |
| `published.ts` | backend の扱い（配布経路 / 窓の対象外 / 経路無し）と、経路ごとの公開日時の読み方 |
| `rules.ts` | 差分の選別、窓の宣言の読み取り、pin 1 件の判定 |
| [`../lib/mise-pins.ts`](../lib/mise-pins.ts) | `mise.toml` の pin と免除の読み取り（棚卸しと共有） |
| [`../lib/withdrawal-date.ts`](../lib/withdrawal-date.ts) | 撤回条件の日付と暦日（棚卸しと共有） |

## 呼び出し口

- [`.makefiles/security/tools-cooldown.mk`](../../.makefiles/security/tools-cooldown.mk)
- [`.github/workflows/tools-cooldown.yaml`](../../.github/workflows/tools-cooldown.yaml) — PR では
  `check`、週次と手動では `audit`

## 関連する ADR

- [0110](../../docs/adr/0110-security-operations.md) — 配布経路ごとの窓と、言語ランタイムの除外
- [0157](../../docs/adr/0157-inspection-declaration-discipline.md) — 成立しない検査を「違反なし」へ倒さない
- [0159](../../docs/adr/0159-script-structure.md) — 入口と判定の分離

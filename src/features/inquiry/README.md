---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 画面まるごとの story は例外
test-requirement: feature
coverage-exclusions:
  - "src/features/inquiry/inquiry.fixture.ts"
---

# inquiry

利用者がサポートとやり取りする画面スライスです。届いた 1 通が**取り直しを待たずに**画面へ出る、
このリポジトリで唯一の設置面でもあります。

## 受け入れるもの

- やり取りの取得と送信の編成（取得は Server Component、送信は Server Action）
- 届いた event を画面の状態へ畳み込むこと（正本との突合・日付の区切り）
- 受信できているかどうかの言い方（回線の有無と購読の状態を、1 つのラベルへ写す）

## 受け入れないもの

- 購読そのもの（接続・整列・重複排除・張り直し・打ち切りの判断は `adapters/client/stream` の領分）
- 発券（同一オリジンの Route Handler が中継します。`src/app/api/inquiries/me/stream-ticket/`）
- 問い合わせの状態遷移（契約が持ちません。開始と最終更新だけがあり、close も reopen もありません）
- 運営側の一覧と回答（`admin` の領分。feature 間で直接参照しません）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/mypage/inquiry` | [`screen`](../../../docs/spec/route/shop/mypage/inquiry/page.screen.md) / [`function`](../../../docs/spec/route/shop/mypage/inquiry/page.function.md) | 必要 |

使う operationId。

| operationId | 用途 |
| --- | --- |
| `GetInquiriesMeMessages` | 履歴の取得。応答の `streamCursor` が購読の開始位置になる |
| `PostInquiriesMeMessages` | 1 通の送信。最初の 1 通が問い合わせを作る |
| `PostInquiriesMeStreamTicket` | 購読を開く口の発券。ブラウザは中継（`/api/`）越しに呼ぶ |
| `GetStream` | 購読そのもの。**ブラウザが backend へ直接開く**ため、この slice は URL を組まない |

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| お問い合わせ | success | `Page/Mypage/Inquiry/Default` |
| | empty | `Page/Mypage/Inquiry/Empty` |
| | 長い本文・連続文字列 | `Page/Mypage/Inquiry/LongBody` |
| やり取りの並び | 送信中 | `Features/Inquiry/Thread/MessageList/Sending` |
| | 空 | `Features/Inquiry/Thread/MessageList/Empty` |
| 送信欄 | idle / pending / 項目エラー | `Features/Inquiry/Thread/Composer/{Default,Pending,Invalid}` |
| 受信の状態 | 7 種 | `Status/ConnectionStatus/*` |
| 待機表示 | loading | 画面と同じ高さの枠（`thread/ui/skeleton/`） |

**error は画面としては持ちません。** 送信の失敗は送信欄の隣に出し、取得の失敗は route の
`error` 境界（`src/app/(shop)/mypage/inquiry/error.tsx`）が受けます。

## 構成

| ファイル | 役割 |
| --- | --- |
| `actions.ts` | 送信の Server Action |
| `form-names.ts` | 送信が持つ項目の名前。**検証を持たない** —— 入力欄が要るのは綴りだけ |
| `parse-message-form.ts` | 送信された内容から本文と冪等キーを取り出す |
| `connection-status.ts` | 購読の状態と回線の有無を、画面へ出す 1 語へ写す |
| `facade/paths/` | この feature が持つルート。**他の feature が指す口** |
| `thread/page-content.tsx` | 履歴の取得と組み立て |
| `thread/view.tsx` | 全画面の表示。器の高さを確定させる |
| `thread/ui/conversation/` | 購読・送信・畳み込みを束ねる client island |
| `thread/ui/message-list/` | やり取りの並び。取得も並べ替えも持たない |
| `thread/ui/composer/` | 送信欄。書きかけを持ち、成立したときだけ片付ける |
| `thread/ui/skeleton/` | 待機表示。出来上がりと同じ高さの器を先に置く |
| `inquiry.fixture.ts` | story とテストが読む固定のやり取り |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `adapters` | 履歴の取得と送信、購読（`client/stream`）、event の検証（`client/api/inquiries`）、本文の上限（`client/api/inquiry-limits`） |
| `model` | 表示モデル（`InquiryMessage` / `InquiryHistory`）、正本と受信分の畳み込み、`ActionState`、冪等キー |
| `components` | 会話の面（`Message` / `Bubble` / `Marker` / `MessageScroller`）と受信の状態 |
| `capabilities` | 回線の有無（`use-online-status`） |
| `observability` | 描画を span に載せる |

## Action 戻り値契約

| Action | 置き場 | 戻り値 | 成功後 | 失敗時 |
| --- | --- | --- | --- | --- |
| `sendInquiryMessageAction` | `actions.ts` | `ActionState<void, "body">` | `revalidatePath("/mypage/inquiry")` | 項目の文言（本文）か、送信欄の隣の文言 |

**冪等キーを必ず載せます。** メッセージは自然キーを持たないため、応答が届かなかっただけの送信を
送り直すと 2 通目になります。鍵は成立するまで同じ値を使い、成立した時点で作り直します。

## テスト観点

- [ ] 取り直した正本に入ったぶんが、購読で受け取った控えから落ちる（同じ 1 通が二重に並ばない）
- [ ] 届いた順が前後しても、位置の昇順に並ぶ
- [ ] まだ 1 通も無い利用者では購読を始めない（発券の口を叩かない）
- [ ] 送信が成立すると書きかけが消え、通らなかったときは残る
- [ ] 送信が成立すると冪等キーが変わり、通らなかったときは変わらない

## 運用

- **購読が運ぶのは「まだ取り直していない追記分」だけです。** 取得した一覧の写しではないため、
  `stores` へは載せません。画面を離れれば次の取得が最新を返し、消えても正しさは壊れません
- **開始位置は取得の応答から来ます。** 履歴を返す口がその時点の購読の位置を一緒に返すので、
  取得と購読の間に隙間ができません。位置を自分で組み立てると、その隙間の event が落ちます
- **取り直しの合図は購読から来ます。** 窓を越えて遅れた event を見つけた購読は、届いた位置へ
  挿し込む代わりに正本の取り直しを求めます。受けた側は `router.refresh()` を呼び、新しい位置で
  購読を再開します
- **送信は購読の外を通ります。** 送信の失敗は分類として呼び出し側へ返る必要があり、購読には
  その往復がありません。送った 1 通は取り直した正本に現れます
- **楽観追加を識別子で突合しません。** 契約の送信は client 側の識別子を受け取らないため、
  echo で突き合わせる経路がありません。代わりに送信中の本文を末尾へ置き、成立した時点で正本へ
  入れ替えます。**確定した 1 通と同じ向き・同じ面で置く**ので、入れ替わりは目に見えません
- **受信の状態を出したままにします。** 切れている間だけ出すと、出ていないことが「繋がっている」と
  「そもそも購読していない」のどちらなのか画面から読めません。回線の有無を先に見るのは、
  回線が切れているときの購読が必ず張り直しの途中にあるためです
- **`⌘Enter` / `Ctrl+Enter` で送信できます。** この画面の中で完結する操作なので、登録の機構を
  作らずに送信欄が直接持ちます
- **見出しを置きません。** 画面の高さをやり取りと送信欄で使い切るためで、この画面が何かは
  global nav とタブのタイトルが示します

## 関連する ADR

- [0074](../../../docs/adr/0074-runtime-communication-seam.md) — 購読 seam の契約（transport / 認証 / 順序 / 再接続）
- [0061](../../../docs/adr/0061-form-mutation-ux.md) — 送信は Server Action の往復
- [0060](../../../docs/adr/0060-state-management.md) — server state の写しを client に持たない
- [0027](../../../docs/adr/0027-directory-structure.md) — 物理配置と co-location

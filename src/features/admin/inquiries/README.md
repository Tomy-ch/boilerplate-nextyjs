---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 画面まるごとの story は例外
test-requirement: feature
coverage-exclusions:
  - "src/features/admin/inquiries/inquiries.fixture.ts"
---

# admin/inquiries

届いた問い合わせを見比べ、1 件に回答する画面スライスです
（`/admin/inquiries` と `/admin/inquiries/[inquiryId]`）。

## 受け入れるもの

- 一覧の取得とページ送りの編成、1 件のやり取りの取得
- 回答の送信の組み立てと、その結果の表示
- 更新フィードの購読と、それを受けた取り直し

## 受け入れないもの

- 購読そのもの（接続・整列・張り直しは `adapters/client/stream` の領分）
- 並び順と絞り込みの軸（契約が決める。更新の新しい順しか無い）
- 役割の確認（バックエンドが持ち、足りなければ `403` が返る）
- 利用者側の問い合わせ画面（`inquiry` の領分。feature 間で直接参照しません）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/admin/inquiries` | [`screen`](../../../../docs/spec/route/admin/inquiries/page.screen.md) / [`function`](../../../../docs/spec/route/admin/inquiries/page.function.md) | 役割: admin |
| `/admin/inquiries/[inquiryId]` | [`screen`](<../../../../docs/spec/route/admin/inquiries/[inquiryId]/page.screen.md>) / [`function`](<../../../../docs/spec/route/admin/inquiries/[inquiryId]/page.function.md>) | 役割: admin |

親（[`admin`](../README.md)）の「認可」がこの画面にもそのまま掛かります。

使う operationId。

| operationId | 用途 |
| --- | --- |
| `GetInquiries` | 一覧の取得。更新の新しい順で本文を含まない |
| `GetInquiriesDetailMessages` | 1 件のやり取りの取得 |
| `PostInquiriesDetailMessages` | 回答の送信。送り手の種別はサーバが決める |
| `PostInquiriesFeedStreamTicket` | 更新フィードを購読する口の発券 |

**会話そのものを購読する口はありません。** 契約が持つのは「自分の問い合わせ」と「更新フィード」の
2 つで、運営が任意の 1 件を直接購読する口が無いためです。開いている 1 件の更新はフィードから
知り、正本を取り直します。

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| 一覧 | success | `Page/Admin/Inquiries/List/Default` |
| | empty | `Page/Admin/Inquiries/List/Empty` |
| 対応 | success | `Page/Admin/Inquiries/Detail/Default` |
| 受信の状態 | 7 種 | `Status/ConnectionStatus/*` |

## 構成

| ファイル | 役割 |
| --- | --- |
| `actions.ts` | 回答の Server Action |
| `parse-reply-form.ts` | 送信された内容から回答先・本文・冪等キーを取り出す |
| `connection-status.ts` | フィードの状態と回線の有無を、画面へ出す 1 語へ写す |
| `query.ts` | ページ送りの URL を組む側 |
| `read-location.ts` | ページ送りの URL を読む側 |
| `list/page-content.tsx` | URL の解釈と一覧の組み立て |
| `list/results.tsx` | 1 ページぶんの取得とページ送り |
| `list/view.tsx` | 一覧の画面。購読を一覧本体の外に置く |
| `list/ui/table/` | 問い合わせの表。本文を持たない |
| `list/ui/feed-watch/` | 更新フィードの購読と、受信の状態 |
| `list/ui/skeleton/` | 一覧の待機表示 |
| `detail/page-content.tsx` | 1 件の取得と組み立て |
| `detail/view.tsx` | 対応の画面。概要とやり取りを縦に並べる |
| `detail/breadcrumb-content.tsx` | 現在地までの階層。`@breadcrumb` の slot が使う |
| `detail/ui/conversation/` | 購読・回答・表示を束ねる client island |
| `detail/ui/message-list/` | 運営から見たやり取りの並び |
| `detail/ui/reply-form/` | 回答の入力欄 |
| `detail/ui/skeleton/` | 対応の待機表示 |
| `ui/breadcrumb-trail/` | 一覧へ戻る階層 |
| `inquiries.fixture.ts` | story とテストが読む固定の一覧 |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `adapters` | 一覧・やり取りの取得と回答の送信、フィードの購読 |
| `model` | 表示モデル（`InquirySummary` / `InquiryHistory`）、日付の区切り、`ActionState`、冪等キー |
| `components` | 表・会話の面・ページ送り・受信の状態 |
| `capabilities` | 回線の有無（`use-online-status`） |
| `observability` | 描画を span に載せる |

## Action 戻り値契約

| Action | 置き場 | 戻り値 | 成功後 | 失敗時 |
| --- | --- | --- | --- | --- |
| `replyInquiryAction` | `actions.ts` | `ActionState<void, "body">` | 開いている 1 件だけ `revalidatePath` | 項目の文言（本文）か、回答欄の隣の文言 |

**回答先は画面が送信に載せます。** 運営は複数の問い合わせを行き来するため、「いま開いているもの」
をサーバ側で決められません。

## テスト観点

- [ ] 通ってきた起点を URL へ積み、戻る操作で 1 段ずつ降ろす
- [ ] 起点が消えた URL で、先頭ページとして読む（「前へ」が押せない）
- [ ] 開いている問い合わせ以外の更新では、取り直さない
- [ ] 回答が成立すると、開いている 1 件だけを取り直す

## 運用

- **購読を一覧本体の外に置きます。** 中に置くと、取り直しのたびに購読ごと unmount され、
  取り直すたびに発券からやり直すことになります
- **フィードが運ぶ内容で行を書き換えません。** 運ぶのは「どの問い合わせがどこまで進んだか」だけで、
  並び順の基準も他の列も入っていません
- **フィードの位置と会話の位置は別物です。** フィードの event が本文に載せる位置は会話の中での
  位置で、フィードの再開位置ではありません。取り違えると、問い合わせが 2 件以上ある環境で
  再開位置がずれます
- **開始位置を渡さずに購読します。** 一覧の取得はフィードの位置を返さないため、発券が束ねた位置
  から始まります。取りこぼした更新は次の更新で取り返されます
- **右へ寄るのは運営の発言です。** 同じやり取りでも、誰が読んでいるかで「自分」が入れ替わります。
  利用者側と部品を共有していないのはこのためで、共有すると向きの判断が引数として両方へ漏れます
- **誰の問い合わせかを出せません。** 契約が返すやり取りは送り手の種別しか持たず、利用者の識別子は
  一覧の行だけが持ちます

## 関連する ADR

- [0074](../../../../docs/adr/0074-runtime-communication-seam.md) — 購読 seam の契約
- [0073](../../../../docs/adr/0073-pagination-fetch-boundary.md) — cursor 方式のページ送り
- [0061](../../../../docs/adr/0061-form-mutation-ux.md) — 送信は Server Action の往復
- [0070](../../../../docs/adr/0070-backend-role-separation.md) — バックエンドとの責務線

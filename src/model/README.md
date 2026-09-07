---
imports-allowed: [errors]
forbidden: [fetch, config, business-logic]
test-requirement: unit
coverage-exclusions:
  - "src/model/generated/design-token.ts"
---

# model

表示用 Value Object、フォーマッタ、単位変換、表示バリデーション、表示結果型を置く純粋なカーネルです。

## 受け入れるもの

- 複数箇所から参照される表示上の値・変換・検証規則
- `ActionState<T>` など表示層の結果型
- **画面が送信の単位を決めるために作る値**。送信 1 回ぶんを指す冪等キーがこれで、値そのものは
  プロトコルの語彙だが、**いつ新しくするかを決めているのは画面**（開き直したら別の送信）である
  ため、`adapters` ではなくここが持つ

## 受け入れないもの

- バックエンドが所有する業務ルール、fetch、config、外部型の漏洩

## モジュール

| モジュール | 役割 |
| --- | --- |
| [`rich-text/`](rich-text/README.md) | リッチテキストの sanitize port。HTML 文字列を表示してよい範囲の木へ変換する |
| `breakpoint.ts` | 段に達していない幅の media query を組む。幅は design token が持つ |
| `datetime.ts` | 日時の locale 対応フォーマッタ |
| `locale.ts` | 既定 locale。フォーマッタが省略時に用いる単一の差し替え点 |
| `generated/breakpoint.ts` | 段の名前と幅。`tokens/` から生成する（手編集禁止） |
| `media.ts` | 配信基盤のオブジェクトキーから表示 URL を組み立てる |
| `pagination.ts` | cursor 方式の 1 ページを表す型と、増分取得での継ぎ足し |
| `action-state.ts` | Server Action が画面へ返す結果の器。項目エラー・フォームエラー・成功値 |
| `search-params.ts` | URL の同じキーが何回現れたかを値の意味へ直す規則。zod スキーマと組み合わせて使う |
| `idempotency-key.ts` | 変更 1 回ぶんを指す鍵と、それを載せるフォーム項目の名前 |
| `consent.ts` | 任意の用途に cookie を使ってよいかという意思と、その区分ごとのゲート述語 |
| `money.ts` | 最小単位の整数で持つ金額を、locale に沿った通貨表記へ整える |
| `cart/cart.ts` | サンプル画面が扱うカートの表示用の型 <!-- sample:line --> |
| `dashboard/dashboard.ts` | サンプル画面が扱う管理側の横断集計の表示用の型と、集計対象期間の語彙 <!-- sample:line --> |
| `product/product.ts` | サンプル画面が扱う商品の表示用の型 <!-- sample:line --> |
| `time-window.ts` | 集計・絞り込みが対象にする期間。暦の区分を、店のタイムゾーンで瞬時の半開区間へ写す |
| `purchase/purchase.ts` | サンプル画面が扱う購入履歴の表示用の型 <!-- sample:line --> |
| `purchase/purchase-status.ts` | サンプル画面が扱う購入ステータスの業務キー。分岐はこの値で行う <!-- sample:line --> |
| `user/` | サンプル画面が扱う利用者の表示用の型と、プロフィール入力の表示検証 <!-- sample:line --> |

## 運用

- 依存先は `errors` のみ
- ファイル名は kebab-case、型名は PascalCase、関数名は camelCase とする

## 関連する ADR

- [0021](../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。ここが `errors` だけを引く根拠
- [0029](../../docs/adr/0029-type-design-discipline.md) — 判別可能 union・branded id・境界で 1 度だけ parse する型設計
- [0031](../../docs/adr/0031-policy-state-supply.md) — 同意などポリシー状態の供給の形
- [0045](../../docs/adr/0045-fonts-and-images.md) — 画像の配信元と、組み立てた URL がそこから出ないこと
- [0061](../../docs/adr/0061-form-mutation-ux.md) — Server Action が画面へ返す結果の器（`ActionState`）
- [0062](../../docs/adr/0062-form-input-validation.md) — 表示のための入力検証と、生成スキーマを持ち込まない線
- [0063](../../docs/adr/0063-mutation-result-notification.md) — 結果の通知手段（inline / toast / redirect）の選択
- [0070](../../docs/adr/0070-backend-role-separation.md) — 業務ルールはバックエンドが持ち、ここは表示のための型だけを持つ分界
- [0073](../../docs/adr/0073-pagination-fetch-boundary.md) — cursor 方式と offset 方式それぞれの取得境界
- [0079](../../docs/adr/0079-auth-frontend-seam.md) — session の中身・復帰先・認可判定の front 側の持ち分
- [0120](../../docs/adr/0120-locale-aware-formatting.md) — locale 依存の整形と、日付演算をタイムゾーンへ固定する扱い
- [0131](../../docs/adr/0131-cookie-consent.md) — 同意管理を採らない決定と、それでも残す区分・期限

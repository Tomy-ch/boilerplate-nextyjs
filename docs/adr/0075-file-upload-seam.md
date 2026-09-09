# ファイルの受け取りと配信(受け口は Server Action、配信は公開の配信元)

[0070](0070-backend-role-separation.md) の thin proxy 境界(`/api/*`)に隣接して生じる、ファイルを受け取る口と、受け取ったものを見せる経路を定める。隣接する決済 UI の seam は [0076](0076-payment-ui-seam.md)、BFF abuse 保護の境界は [0077](0077-bff-abuse-protection-boundary.md) が持つ。

## Status

Accepted

## 背景

[0070](0070-backend-role-separation.md) が `/api/*` を **thin proxy** に限定し、[0071](0071-bff-api-integration.md) の fetch wrapper は JSON を前提に組んである。ファイルはそのどちらにも素直に乗らないため、受け口と配信を別に決める必要がある。

決めるべきことは 2 つある。**誰が本体を受け取るか**と、**受け取ったものをどこから配るか**である。

## 決定

### 受け口は Server Action で、本体は backend の受け口へそのまま送る

ファイルを受けるのは **Server Action** であり、`/api/*` に中継専用の口を作らない。表現層のサーバは本体を保持せず、`adapters/server` が backend の受け口へ `multipart/form-data` として送り、**保存キーだけを受け取る**。

口を 2 つ持たない理由は、Server Action が既に「画面からの送信を受けて `adapters` を呼ぶ」役を持っているためである。同じ役の口を Route Handler 側にも作ると、上限と検査を 2 か所で揃え続けることになる。

**受け口には必ずサイズの上限と、宣言された種類の検査を置く。** 署名で送信内容を縛る層が無いので、ここが唯一の関所になる。**宣言された種類は送信者が付けられる値**なので、それだけを根拠に中身を信用しない。上限は**配備先のボディ上限より内側**に置く —— 外側に置くと配備先が先に打ち切り、その上限は効かない。

> 強制: 受け口側の上限は起動時設定から引き、フレームワークの本体上限も同じ値から導く。2 か所に数字を書かない。

### 配信は公開の配信元から行い、表現層は配信元を知らない

**この本体が扱うのは、配信の時点で公開されているものだけである。** backend が返すのは保存キーで、公開 URL への組み立ては `adapters/server` が起動時設定の配信元と結合して行う。画面の層は配信元を読めない([0021](0021-frontend-responsibility.md) / `architecture.ts`)。

この前提の帰結として、**主体ごとに見せる相手が変わるものを、この経路へ載せてはならない。** 公開の配信元に置いたものは、URL を知る誰にでも届く。見せる相手を絞る必要があるものは、絞れる口を backend 側に持たせる。

### 署名付き URL への直接送信は採らない

ブラウザが署名付き URL へ直接送る形は**採らない**。署名の発行は backend の責務であり、この本体は発行口があることを前提にしない。加えて、配信が公開である以上、**署名が守ろうとしていた面がそもそも無い**。

同じ理由で、進捗 / 中断 / 再開の機構も**実体化しない**。用途依存であり、設置面が現れた時点で `adapters/client` の seam として置く。本 ADR が持つのはその座標だけである。

## 禁止事項

- ❌ `/api/*` にファイル本体を受ける中継口を作ること(受け口は Server Action。同じ役の口を 2 つ持たない)
- ❌ 受け口にサイズ上限か種類の検査を置かないこと(署名で縛る層が無いので、ここが唯一の関所)
- ❌ 宣言された種類だけを根拠に中身を信用すること(送信者が自由に付けられる)
- ❌ 受け口の上限を配備先のボディ上限より外側に置くこと(配備先が先に打ち切る)
- ❌ Server Action の上限を引き上げるとき、それが他の action へ及ぶことを確かめずに済ませること
- ❌ **見せる相手を絞る必要があるものを、公開の配信元へ載せること**
- ❌ 配信元を画面の層から読むこと(組み立ては `adapters/server`。[0021](0021-frontend-responsibility.md))
- ❌ 送信の生 fetch や進捗管理をコンポーネントへ散らすこと([0024](0024-adapters-server-client-split.md))

## 補足

日常強制される規約(上限の具体値・受け口の実装規約)は [docs/rules.md](../rules.md) が持つ。

## 関連 ADR

- [0070-backend-role-separation.md](0070-backend-role-separation.md)— `/api/*` を thin proxy に限る境界
- [0071-bff-api-integration.md](0071-bff-api-integration.md)— fetch wrapper が JSON を前提にすること
- [0076-payment-ui-seam.md](0076-payment-ui-seam.md)— 決済 UI seam。thin proxy 境界に隣接する別主題
- [0077-bff-abuse-protection-boundary.md](0077-bff-abuse-protection-boundary.md)— BFF abuse 保護。同じく隣接する別主題
- [0112-data-classification-cache-boundary.md](0112-data-classification-cache-boundary.md)— 分類ごとの置き場と関所

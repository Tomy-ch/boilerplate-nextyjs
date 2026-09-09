# フォーム入力検証 UX(client 検証・生成 zod の再利用境界)

送信前の**入力検証 UX** を 1 本に定める。表示レベルの入力検証(必須 / 形式 / 文字数など UX 用)を client でも行い即時フィードバックする既定と、**表示バリデーション規則(`model` の手書き zod スキーマ)** と **契約検証(`adapters` 境界・生成スキーマ)** の**二層分離**、および生成 zod([0072](0072-api-type-generation.md))の client 再利用の境界(具体的許容範囲は [0072](0072-api-type-generation.md) 管轄)を定める。client 検証は [0060](0060-state-management.md) が採用する **react-hook-form + zodResolver** で行い(resolver に食わせるのは `model` の表示検証スキーマ)、送信メカニクス([0061](0061-form-mutation-ux.md))の `ActionState` 契約へフィールドエラーを供給する層である。

## Status

Accepted

## 背景

[0060](0060-state-management.md) は form state に **react-hook-form + zod(`zodResolver`)を採用**している。ただし rhf + resolver は「検証を回す機構」であって、「**どのスキーマで・どのタイミングで検証し、生成 wire スキーマとどう切り分けるか**」は別途規約が要る。これが空白のままだと、boilerplate で最頻出のフォーム入力が、feature ごとに検証タイミングも二重管理の扱いも不統一になる。

入力検証は送信メカニクス([0061](0061-form-mutation-ux.md))と結果通知([0063](0063-mutation-result-notification.md))の間に位置し、送信前の即時フィードバック UX と、生成物(wire スキーマ)を client 入力検証に再利用してよいかという型漏洩境界の判断が交差する。本 ADR は前者(入力検証 UX の既定 = どのスキーマを resolver に食わせるかを含む)を敷き、後者の具体的許容範囲は生成物と型漏洩の権威である [0072](0072-api-type-generation.md) に委ねる。

## 決定

### 1. client 表示検証と検証タイミング

- **入力検証を server round-trip 前提にしない**。表示レベルの入力検証(必須 / 形式 / 文字数など UX 用)は client でも行い、即時フィードバックする
- 検証タイミングの既定 = **誤りを出すのは項目から focus が外れた時点。focus が当たっている間、検証は表示を消す方向にだけ効かせ、新しい誤りを出さない**(reward early, punish late)。入力の 1 文字目から赤くしないのは、まだ書いている途中の項目を誤りとして知らせないためであり、focus が外れた時点は「その項目を書き終えた」と見なせる最も早い機会である。**直ったことは focus を外す前に反映する** —— 直っても消えないと、利用者は blur するまで直ったかどうかを確かめられない。submit まで待つ形を既定にしない —— 誤りの数だけ往復させることになり、どこを直すかも submit するまで判らない。エラー文言は日本語(AGENTS.md Language Rules)
- **候補から選ぶ項目には既定の選択を置かず、空の候補を先頭に置く。** 既定で先頭が選ばれた形にすると、確かめずに送った値と意図して選んだ値を区別できず、必須の選択欄を検証する意味が無くなる。選んでいないことと、先頭の候補を選んだことは別である
- 検証結果は送信メカニクス([0061](0061-form-mutation-ux.md))の `ActionState` の fieldErrors / formError として表示層へ渡る(通知手段の使い分けは [0063](0063-mutation-result-notification.md))

### 2. 検証の二層分離(表示規則 vs 契約検証)

検証を**二層に分離する**(この分離が [0072](0072-api-type-generation.md) の型漏洩禁止との整合の要):

- **表示バリデーション規則** = `model` が持つ**手書きの zod スキーマ**([0021](0021-frontend-responsibility.md)「表示バリデーション規則」)。UX 用のフィールド規則であり、**wire contract ではない**ため [0072](0072-api-type-generation.md) の型漏洩禁止の対象外。**client 入力検証(rhf の `zodResolver`)に食わせるのはこの `model` 表示検証スキーマ**であり、[0060](0060-state-management.md) が「zod スキーマを入力契約の SSOT とし client の `zodResolver` と共有する」と言う際の SSOT はこの表示検証スキーマを指す。同じ判定を送る前(client)と受け取った後(Server Action)の両方が通す —— 受け取った後にも確かめるのは、送る前の判定が送信者に差し替えられるためである。判定と文言は `model` の 1 か所が持ち、両側へ書き写さない
- **契約検証** = `adapters` 境界。request は生成 request スキーマ、response は生成 response スキーマで `.parse()`([0071](0071-bff-api-integration.md) / [0072](0072-api-type-generation.md))。契約破れは正規化エラー([0080](0080-error-handling.md))として扱う。**生成 wire スキーマを rhf の resolver へ直接食わせない**のが既定(生成物を feature/`model` へ漏らさない = 型漏洩禁止)。生成 request スキーマの client 再利用可否は §3 のとおり [0072](0072-api-type-generation.md) 管轄

### 3. 生成 zod の client 再利用境界(具体的許容範囲は 0072 が持つ)

- 生成 zod([0072](0072-api-type-generation.md))の **request-body スキーマ**を client 入力検証へ再利用してよいか(スキーマ二重管理の回避)は、[0072](0072-api-type-generation.md) の**型漏洩禁止・生成物管轄と接する**
- **本 ADR は「二重管理を避ける」原則と上記二層分離までを定め、生成スキーマを client bundle に載せる具体的許容範囲は [0072](0072-api-type-generation.md) が持つ**。0072 は生成スキーマを client へ載せず、契約が定める上限・書式の**定数だけ**を検証と別の module で配る形を採っている。client の入力検証が契約由来の値を要るときはその定数を引き、スキーマ本体は引かない

## 禁止事項

- ❌ 入力検証を server round-trip でしか出さない UX(client でも表示検証する)
- ❌ 表示バリデーション規則(`model`・手書き)と生成 wire スキーマ(`adapters/gen`)を混同し、生成スキーマを `model` / feature のドメインロジックへ漏らすこと([0072](0072-api-type-generation.md) 型漏洩禁止)
- ❌ 生成 zod の client 再利用の具体的許容範囲を、本 ADR で確定すること(権威は [0072](0072-api-type-generation.md))
- ❌ 検証タイミングを feature ごとにばらつかせること(既定 = focus が外れた時点に出し、focus 中は消える方向にだけ効かせる)
- ❌ focus が当たっている項目へ新しい誤りを出すこと(編集の途中を咎めることになる)
- ❌ 候補から選ぶ項目に既定の選択を置くこと(未選択と先頭の候補を区別できなくなる)

## 補足

- **rhf の `reValidateMode` だけでは §1 を満たせない**。あの設定が効くのは submit のあとだけで、blur で出した誤りは change では見直されない。素直に書くと「直しても消えない」状態になり、しかも設定は宣言されているので読んだだけでは気づけない。既定を満たすには、blur 済みの項目を change でも検証したうえで、focus 中の表示を「focus した時点の文言」で頭打ちにする
- 日常強制の細則(検証タイミングの厳密値・文言トーン等)は [docs/rules.md](../rules.md) が持つ

## 関連 ADR

- [0061-form-mutation-ux.md](0061-form-mutation-ux.md) — 送信メカニクス(本 ADR の検証結果を運ぶ `ActionState` 契約の供給元)
- [0063-mutation-result-notification.md](0063-mutation-result-notification.md) — 変更結果の通知 UX(本 ADR のフィールドエラーを表示する層)
- [0072-api-type-generation.md](0072-api-type-generation.md) — 生成 zod / 型漏洩禁止(client 再利用許容範囲の権威)
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — `adapters` 境界での契約検証(`.parse()`)
- [0080-error-handling.md](0080-error-handling.md) — 契約破れの正規化エラー
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `model`(表示バリデーション規則の所有)
- [0060-state-management.md](0060-state-management.md) — form state = react-hook-form + zod(`zodResolver`)採用。resolver に食わせるのは本 ADR の `model` 表示検証スキーマ(zod SSOT)

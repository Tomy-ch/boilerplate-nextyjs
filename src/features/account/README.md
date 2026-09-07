---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 画面まるごとの story は例外
test-requirement: feature
coverage-exclusions:
  - "src/features/account/__mocks__/**"
  - "src/features/account/account.fixture.ts"
---

# account

自分の登録情報を作り、確かめ、変えて、やめるための画面スライスです。

## 受け入れるもの

- 自分の情報・購入の集計・都道府県マスタの取得の編成
- 登録・プロフィールの更新・退会の Server Action（編成のみ）
- 認証と登録の状態から、保護された画面の行き先を決める判定
- この画面専用の表示（登録情報のカード・集計の表・登録と編集のフォーム・退会の確認）

## 受け入れないもの

- 他 feature への直接依存
- 汎用に使える表示（`Card` / `Table` / `AlertDialog` / `Field` などは `components` から取る）
- 認証そのもの（session の復元・破棄は `adapters/server/auth` の領分）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/mypage` | [`screen`](../../../docs/spec/route/shop/mypage/page.screen.md) / [`function`](../../../docs/spec/route/shop/mypage/page.function.md) | 必要 |
| `/mypage/edit` | [`screen`](../../../docs/spec/route/shop/mypage/edit/page.screen.md) / [`function`](../../../docs/spec/route/shop/mypage/edit/page.function.md) | 必要 |
| `/onboarding` | [`screen`](../../../docs/spec/route/auth/onboarding/page.screen.md) / [`function`](../../../docs/spec/route/auth/onboarding/page.function.md) | 必要（登録はまだ無い状態） |

使う operationId。

| operationId | 用途 |
| --- | --- |
| `GetUsersMe` | 自分の情報。登録の有無の判定も同じ口を引く |
| `PostUsers` | 登録。冪等キーを載せる |
| `PutUsersDetail` | プロフィールの更新 |
| `DeleteUsersDetail` | 退会 |
| `GetUsersMePurchasesSummary` | 購入の集計 |
| `GetPurchases` | マイページの履歴 dialog に並べる分 |
| `GetPrefectures` | 都道府県の候補。全 47 件が固定で返る |
| `GetAddresses` | 郵便番号からの住所補完。`/api/addresses` 経由 |

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| マイページ | success | `Page/Account/Mypage/Default` |
| | empty（購入が無い） | `Page/Account/Mypage/NoPurchases` |
| | loading | `Features/Account/Mypage/Skeleton/Default` |
| プロフィール編集 | success | `Page/Account/ProfileEdit/Default` |
| | loading | `Features/Account/Edit/Skeleton/Default` |
| | 誤りを見せている | `Features/Account/Edit/ProfileForm/ValidationErrors` |
| | 住所が埋まった | `Features/Account/Edit/ProfileForm/AddressCompleted` |
| | 該当が無い | `Features/Account/Edit/ProfileForm/AddressNotFound` |
| 登録 | 段ごと | `Page/Account/Onboarding/{Default,AddressStep,ConfirmStepFilled}` |
| | 誤りを見せている | `Page/Account/Onboarding/ValidationErrors` |
| | 補完の機構が動いていない | `Page/Account/Onboarding/AddressUnavailable` |

error は route の `error` 境界（`src/app/(shop)/mypage/error.tsx` と
`src/app/(shop)/mypage/edit/error.tsx`）が受けます。

## 構成

画面（`mypage` / `edit` / `onboarding`）ごとに掘り、その中を性質で分けます。どの画面にも属さない
ものは画面を挟まず直下へ置きます。**登録と編集は同じ 9 項目を同じ規則で扱う**ため、入力欄と
検証まわりはその直下にあります。

| ファイル | 役割 |
| --- | --- |
| `actions.ts` | 登録・プロフィール更新・退会の Server Action。検証と分類だけを持ち、通信は `adapters` が行う |
| `__mocks__/actions.ts` | カタログでの Server Action の差し替え。押せる操作を成立させるためだけに置く |
| `form-state.ts` | Server Action の戻り値の型。`ActionState<T>` を画面の項目名で閉じる |
| `paths.ts` | この feature が持つ 3 つのルートと、登録を促す行き先の組み立て |
| `registration-gate.ts` | 保護された画面の入口。認証と登録の状態を行き先へ変える |
| `field-labels.ts` | 入力欄と確認に出す項目名。label と見出しの出所を 1 つにする |
| `parse-profile-form.ts` | 送信された `FormData` を、登録と更新に渡せる形へ解く |
| `profile-rejection.ts` | 接続先が名指しして拒んだ項目を、送る前の検証と同じ形の文言へ写す |
| `use-error-visibility.ts` | 誤りをいつ見せるかだけを決める。検証はしない |
| `use-profile-fields.ts` | 検証を回し、入力欄 1 つぶんの props を組む |
| `use-address-completion.ts` | 郵便番号から住所を引き、埋める値を決める |
| `use-address-field.ts` | 補完をフォームへ当てる。blur の包み方と埋める先 |
| `ui/text-field/` | 1 行入力の項目 |
| `ui/prefecture-field/` | 都道府県の項目。候補は静的なので native の select で出す |
| `ui/postal-code-field/` | 郵便番号の項目。住所を検索する操作を枠の中に持つ |
| `ui/submit-button/` | 送信の操作。押している間の見せ方を `form` の子として持つ |
| `mypage/page-content.tsx` | 自分の情報と購入の集計の並行取得 |
| `mypage/view.tsx` | マイページの表示。読む 2 枚と、区切りの下の退会を並べる |
| `mypage/ui/profile-card/` | 登録情報の表示と、編集への導線 |
| `mypage/ui/purchase-summary-card/` | 購入の集計。ステータス別の内訳を表で出す |
| `mypage/ui/purchase-history-dialog/` | 購入履歴の一覧。局所スクロールを持つ dialog |
| `mypage/ui/action-row/` | 下端の操作の並び。退会とサイト説明への導線 |
| `mypage/ui/withdraw-button/` | 退会。確認 dialog と送信を持つ client island |
| `mypage/ui/skeleton/` | マイページの待機表示 |
| `edit/page-content.tsx` | 自分の情報と都道府県マスタの並置合成（CollectAll） |
| `edit/view.tsx` | プロフィール編集の表示。パンくずをここが持つ |
| `edit/ui/profile-form/` | 並び。client island |
| `edit/ui/skeleton/` | プロフィール編集の待機表示 |
| `onboarding/page-content.tsx` | 都道府県マスタの取得と、この登録 1 回ぶんの鍵の生成 |
| `onboarding/view.tsx` | 登録の表示。段の器と送信を持つ client island |
| `onboarding/steps.ts` | どの項目がどの段に属するかと、その段を終えられるかの判定 |
| `onboarding/form-names.ts` | 隠し項目の `name`。綴りだけを持ち、検証は読む側へ置かない |
| `onboarding/parse-registration-form.ts` | 送信された `FormData` を、登録に渡せる形へ解く |
| `onboarding/ui/basics-section/` | 名前と連絡先の段 |
| `onboarding/ui/address-section/` | 住所の段。郵便番号からの補完をここが配線する |
| `onboarding/ui/confirm-section/` | 確認の段。入力欄を持たず、送る値を読み返す |
| `onboarding/ui/skeleton/` | 登録の待機表示 |
| `account.fixture.ts` | story とテストが読む固定値 |

### 登録・プロフィール編集の割り方

変わる理由が違うものを分けてあります。どれか 1 つを直すのに他を読まずに済みます。

| 関心 | 持ち主 | 変わる理由 |
| --- | --- | --- |
| どの値が正しいか | `model/user/profile-schema.ts` | 契約や業務上の制約 |
| 誤りをいつ見せるか | `use-error-visibility.ts` | 入力検証 UX の決まり（下記 [0062](../../../docs/adr/0062-form-input-validation.md)）の改訂 |
| 検証を回し props を組む | `use-profile-fields.ts` | この画面の項目が増減したとき |
| 住所を引く | `use-address-completion.ts` | 補完の契約や打ち切りの仕方 |
| 補完をフォームへ当てる | `use-address-field.ts` | どの項目へ埋めるか |
| 入力を解く | `parse-profile-form.ts` | 送信の形（`FormData`）が変わったとき |
| 接続先の拒否を項目へ写す | `profile-rejection.ts` | 契約の項目名がフォームの項目名と食い違ったとき |
| 段の構成と進んでよいか | `onboarding/steps.ts` | 段の割り方が変わったとき |
| 送信を編成する | `actions.ts` | 更新の手順が変わったとき |
| 並び | `edit/ui/profile-form/` / `onboarding/ui/*-section/` | 見た目 |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `adapters` | 自分の情報・集計・履歴・都道府県・住所補完の取得と、登録 / 更新 / 退会 |
| `model` | 表示検証スキーマ（`user/profile-schema`）、表示モデル、冪等キー、`ActionState` |
| `components` | 面を組む器（カード・表・入力欄・確認 dialog） |
| `errors` | 送信が通らなかったときの分類を文言へ写す |
| `observability` | 描画を span に載せる |

他 feature の `facade/` も引きます —— ログイン（`auth`）、購入の行き先（`purchases`）、
サイト説明（`site-info`）。

## Action 戻り値契約

| Action | 置き場 | 戻り値 | 成功後 | 失敗時 |
| --- | --- | --- | --- | --- |
| `registerAction` | `actions.ts` | `ProfileFormState` | 戻り先へ `redirect` | 項目ごとの誤りを画面に残す |
| `updateProfileAction` | `actions.ts` | `ProfileFormState` | `revalidatePath`。画面は移さず toast | 同上 |
| `withdrawAction` | `actions.ts` | `WithdrawFormState` | session を破棄してトップへ | 確認を開いたまま、その中で伝える |

**対象を指す識別子は戻り値にも送信にも載りません。** 解決するのは `adapters` の中です。

## テスト観点

- [ ] 登録の有無まで確かめる入口が、認証済みでも登録前なら登録へ送る
- [ ] focus が当たっている項目へ、当てた時点より後の誤りが出ない
- [ ] 候補が割れた郵便番号で町域が埋まらない
- [ ] 「該当が無い」と「補完が動いていない」で操作の見え方が変わる
- [ ] 退会の確認が、送信中も失敗時も開いたままになる

## 運用

- **表示と編集を別ルートに分けます**。1 つの画面に畳むと、どちらの状態で開いているかが URL から
  失われ、戻る操作も共有もできなくなります
- **合成はフロント側で行います**。編集画面が要る「自分の情報」と「都道府県マスタ」は互いに独立で、
  並べるだけで足ります。ドメインの計算を挟まない合成をバックエンドへ持たせると、画面の都合で契約が
  1 本増えます（[screens.md](../../../docs/spec/screens.md) §1）
- **識別子を画面へ渡しません**。更新と退会が対象を指すのに使う内部の識別子は `adapters` の中で
  解決します。フォームの hidden に載せると、ブラウザに置く理由の無い値が出ます
- **都道府県は `SelectNative` です**。契約が全 47 件を固定で返す静的な候補なので、client island の
  検索 UI を持ち込む理由がありません
- **検証は client と server の両方で通します**。同じ表示検証スキーマ（`model/user/profile-schema.ts`）
  を使いますが、client 側は即時に返すためのもので、通ったことは何の保証にもなりません。契約に
  照らした検証は `adapters` の境界がさらに別に行います
- **focus が当たっている項目へ新しい誤りを出しません**。焦点を当てた時点に出ていた文言を上限に
  して表示します。上限が無いと、書き直そうとして 1 文字消しただけで「入力してください」が
  現れます。直ったことはその場で消して反映します
- **住所の補完は候補が割れた項目を埋めません**。1 つの郵便番号が複数の町域を指すことがあり、
  先頭を無条件に採ると利用者が選んでいない住所が黙って入ります。番地は補完に含まれないため、
  町域を入れるのは丁目・番地が空のときだけです
- **補完に失敗しても先へ進めます**。契約は外部 lookup の障害を `503` ではなく空の候補で返すと
  定めており、画面は手入力を続けさせます
- **「該当が無い」と「補完の機構が動いていない」を言い分けます**。前者は郵便番号を直せば埋まり
  ますが、後者は何度引いても埋まりません。契約が両者を別々に返すので、後者では検索の操作を閉じて
  手入力へ促します。押しても永久に何も起きない操作を残すと、利用者は自分の入力を疑って何度も試します
- **補完が起きたことを読み上げます**。入力欄の値が変わるだけでは、そこを見ていない利用者に
  届きません
- **カタログでは補完の応答をカタログ自身が返します**。`/api/addresses` は Route Handler なので
  Storybook には存在せず、答える相手が居ないと該当なししか出せません。宛先を横取りするのは
  `.storybook/msw/handlers.ts` で、引ける郵便番号は次の 3 つ、それ以外は該当なしになります

  | 郵便番号 | 返る候補 | 確かめられること |
  | --- | --- | --- |
  | `150-0001` | 東京都 / 渋谷区、町域は 2 件 | 候補が割れた項目（町域）を埋めないこと |
  | `220-0012` | 神奈川県 / 横浜市西区 / みなとみらい | 丁目・番地が空のときだけ町域まで埋めること |
  | `000-0000` | 無し（機構が動いていない） | 検索の操作を閉じ、手入力へ促すこと |

- **保存は画面を移さず toast で伝え、退会は移します**。前者はフォームの文脈に留まる操作で、後者は
  成立した時点で留まる先が無くなるためです
- **退会の文言で即時の反映を約束しません**。取り消しと在庫の戻しは結果整合で走るため、直後に古い
  状態を見た利用者が失敗を疑います
- **退会の確認は `AlertDialogAction` を使いません**。押した時点で dialog が閉じる部品なので、
  送信中の表示も失敗の文言も利用者が見ていない場所に出ます。閉じるのは成立して画面が変わるときだけです
- **保護された画面の入口は登録の有無まで確かめます**。認証と登録は別の状態で、前者はログインでしか、
  後者は登録でしか解消しません。判定は `/v1/users/me` を引くので、この入口を通る画面はリクエスト
  ごとに 1 度その取得を行います。取得は React の `cache()` で畳まれるため、自分の情報を読む画面
  では実質増えません
- **登録では、埋まっていない段から進めません**。同じ規則を Server Action も通りますが、往復して
  初めて「入っていない」と言われるより、その場で判る方が直しやすいためです。誤りの文言を出すのは
  触れた項目だけで、進んでよいかの判定は触れたかどうかを見ません
- **登録の二重送信は冪等キーが畳みます**。画面を組み立てた地点が 1 つ作って送信に載せるので、同じ
  画面から何度送っても利用者は 1 人のままです
- **パンくずは編集画面だけが持ちます**。マイページは global nav が直接指すので、同じ導線を二重に
  置くことになります

## 関連する ADR

- [0021](../../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。検証と分類だけを Action に持たせる
- [0026](../../../docs/adr/0026-layout-shell-mount.md) — 殻と Provider の据え付け。global nav とパンくずの分担
- [0027](../../../docs/adr/0027-directory-structure.md) — 物理配置と co-location。画面ごとに掘り、その中を性質で分ける
- [0029](../../../docs/adr/0029-type-design-discipline.md) — 判別可能 union と境界での parse。登録の段と入力の解き方
- [0053](../../../docs/adr/0053-ui-component-interaction-seam.md) — 操作の a11y 継ぎ目。入力欄と確認の継ぎ目
- [0054](../../../docs/adr/0054-ui-catalog-storybook.md) — カタログの方針。Server Action と補完の応答の差し替え
- [0061](../../../docs/adr/0061-form-mutation-ux.md) — `<form action>` + Server Action の正機構
- [0062](../../../docs/adr/0062-form-input-validation.md) — 入力検証の UX。誤りをいつ見せるか、判定の正はどちらにあるか
- [0063](../../../docs/adr/0063-mutation-result-notification.md) — 送信結果の伝え方。toast に留めるか画面を移すか
- [0073](../../../docs/adr/0073-pagination-fetch-boundary.md) — ページ送り / 増分取得の境界。client から引くときの経路
- [0079](../../../docs/adr/0079-auth-frontend-seam.md) — 認証の前面の継ぎ目。入れなかった主体の送り先
- [0080](../../../docs/adr/0080-error-handling.md) — エラーの扱い。`error` 境界の受け持ちと degrade
- [0101](../../../docs/adr/0101-performance-budget.md) — 性能予算。client の束に何を載せるか

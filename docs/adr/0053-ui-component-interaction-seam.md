# UI コンポーネント方針とインタラクション a11y seam

[0052](0052-ui-component-policy.md) は UI コンポーネント基盤(shadcn/ui + @tabler/icons-react + 複雑入力部品)を **v1 で採用**し、複雑入力(日付ピッカー等)は `components` カーネルの shadcn 系部品として同梱済みだが、そこで扱うのは「どの部品を持つか(同梱可否)」であって、**インタラクションを持つ UI の相互作用品質**(キーボード操作・フォーカス管理・ARIA・live region・ドラッグ代替等の a11y seam)は別主題として残る。本 ADR は 0052 とは主題を分け、interaction UI の **a11y interaction seam**(sanitizer port / WCAG 2.2 ドラッグ代替 IF・モーダルの focus/scroll 契約等)を 1 本に束ねる。0052 が v1 で採る部品(複雑入力 / リッチテキスト = TipTap)にも、v2 で採る局所ライブラリ(DnD = dnd-kit 等)にも共通して要求される相互作用 a11y 契約を、本 ADR が所有する(triage #15 / #16 / #22 / #25 / #27)。

## Status

Accepted (a11y interaction seam)

（**採番はブロック帯で確定(2026-07-14・0001〜0155(トピック順ブロック帯))**。本 ADR は triage の interaction UI クラスタ(#15 / #16 / #22 / #25 / #27)を「相互作用 a11y seam(0052 の部品採用とは別主題)」として 1 主題に束ねるため **独立起票**したもの。内容自体はこの設計討議に基づく。日付 2026-07-14。0.0.x の ADR は living document として本文を直接上書きし、改定履歴を積まない。当初は 0052 の exclusion(本体非同梱)を前提に「非同梱境界 + a11y seam」として記していたが、v1 バッテリー採用への転換([0052](0052-ui-component-policy.md) / [master-plan §1.2](../plan/master-plan.md))に伴い、本 ADR の射程を「同梱可否」から相互作用 a11y seam へ純化した)

## 背景

設計フェーズの遡及監査(triage)は、interaction UI クラスタを次のように仕分けた:

- **#16 複雑入力 UI の a11y 契約**(0052 で採用済み)= 日付ピッカー等は 0052 が shadcn 系部品として `components` に **v1 採用済み**。本 ADR は「入れてよいか」ではなく、採用部品の **キーボード操作 / フォーカス順序 / ARIA という相互作用 a11y 契約** を敷く
- **#15 リッチテキスト/エディタ**(**v1 採用**)= 本体は **sanitize IF + 表示 seam**(rehype/sanitize は差し替え可能な port として名前を付ける)。エディタ本体(TipTap)は v1 で実使用する
- **#22 モーダル/ダイアログ**(追補・0040)= native `<dialog>` 既定 / focus trap・Escape・scroll lock 必須(0100)/ route-as-modal(intercepting routes)採否は 0040 管轄
- **#25 キーボードショートカット**(据え置き除外)= v1 / v2 とも採らず、登録機構も置かない
- **#27 ドラッグ&ドロップ**(v2 局所ライブラリ)= 本体は **WCAG 2.2 ドラッグ代替を満たす a11y 準拠 DnD seam/IF**。DnD ライブラリ(dnd-kit 等)は 0052 の区分で **v2 同梱予定**

これらはいずれも **インタラクションが a11y 事故の最頻発地点**(モーダルの focus / DnD のドラッグ代替 / ショートカットの誤発火)であり、[0100](0100-accessibility-target.md) の WCAG 2.x AA 目標と直結するという共通性を持つ。0052 が v1 で採る部品も、v2 で採る局所ライブラリも、相互作用 a11y 契約なしに実装される余地を残さないため、本 ADR は **a11y 拡張点(名前付き seam + a11y 契約)を必ず敷く**。

## 決定

### 1. 貫く原則: プラットフォーム標準・built-in 優先(0010 標準準拠)

interaction UI は、**ライブラリより先にプラットフォーム標準(HTML/CSS/DOM の built-in)を第一候補とする**([0010](0010-standards-and-non-lockin.md) §1 標準準拠)。built-in で要件を満たせないと判明した時にのみ、用途依存の判断として fork 先がライブラリを足す。

- **vendor-independent 正当性材料**([0010](0010-standards-and-non-lockin.md) §2): built-in 優先は「フレームワークが推奨するから」ではなく、web プラットフォーム標準に固有の独立根拠で正当化する ——(a) top-layer / focus / `inert` / `::backdrop` 等の a11y 機構を**ブラウザが既定で供給**する(自前 focus-trap の車輪の再発明を避ける)、(b) **JS ライブラリ依存ゼロ = 任意フレームワークへ可搬**(0010 の運用テスト「ベンダーを正当化から抜いても正当か」= Yes)、(c) **最小依存**(バンドル増を伴わない)。これは 0052 が採る shadcn/ui(Radix = WAI-ARIA 準拠 primitive)とも整合する —— built-in で満たせる相互作用は built-in を先に使い、built-in で足りない範囲を shadcn 系部品 / v2 局所ライブラリで補う、という優先順である

### 2. 複雑入力 UI の相互作用 a11y 契約(#16)

- **日付ピッカー・コンボボックス・オートコンプリート等の複雑入力 UI は、[0052](0052-ui-component-policy.md) が shadcn 系部品として `components` カーネルに v1 採用済み**である。本 ADR は同梱可否ではなく、これら採用部品が満たすべき **相互作用 a11y 契約** を敷く
- built-in 優先(§1)により、要件を満たせる範囲では native input(`<input type="date">` / `<datalist>` / `<select>` 等)を第一候補とし、native で足りない複雑入力にのみ shadcn 系部品(0052)を用いる
- 採用部品・自前実装のいずれでも、**a11y 準拠(キーボード操作 / フォーカス順序 / ARIA / [0100](0100-accessibility-target.md) の WCAG 2.x AA)を必須**とし、[0050](0050-styling-strategy.md)(Tailwind 主軸 + CSS Modules 限定許可・styled-components / emotion は非採用)・[0021](0021-frontend-responsibility.md)(カーネル配置・命名規律)・[0004](0004-library-management.md)(exact pin / audit)の枠内で行う(0052 の採用時条件と同一)

### 3. リッチテキスト/エディタ = TipTap を v1 採用 + sanitizer port + 表示 seam(#15)

- **WYSIWYG エディタは TipTap を v1 で採用**する。エディタ本体は `components` カーネルに置き、[0052](0052-ui-component-policy.md) の配置・exact-pin 要件に従う
- **採る理由はエディタ本体ではなく、その隣に要る表示側の継ぎ目にある。** 利用者が書いた内容を安全に表示する経路は、**後から足すと「通し忘れ」が既に散った後**になる。同梱するのは、その経路を型で塞いだ形（下記の port と nominal type）を実物として置くためであり、fork 先がエディタ本体を差し替えてもこの形は残る
- 実使用面は、**利用者が書いた長文が他の利用者へ表示される欄**である。そういう欄を持たない fork は、エディタごと落として sanitizer port だけを残してよい <!-- sample:line -->
- 「表示」側の拡張点(seam): **信頼できない HTML を安全な表示へ変換する sanitizer を、差し替え可能な named port(seam)として扱う**(rehype/rehype-sanitize / DOMPurify 等は port の実装であって本体前提ではない)。リッチテキスト表示は、この sanitizer port を必ず通す
- sanitizer port は外部ライブラリの wrap であり、[0021](0021-frontend-responsibility.md) のカーネル受入基準(複数箇所参照 or 外部ライブラリ wrap → カーネル)に従って **`model` カーネル**に置く。表示 seam(sanitize 済みコンテンツの描画)は `components` に置く
- **port は sanitize 済みであることを型で表す。** 通過後の値を nominal type として返し、表示側はその型だけを受け取る。生の HTML 文字列を props に取らないため、**sanitizer を迂回する経路が公開 API にも実装にも存在しない**。「通し忘れ」を規約ではなく型で塞ぐ形である
- **描画は HTML 文字列を経由しない。** パース結果の木から直接 React 要素を組み立てる。これにより `dangerouslySetInnerHTML` を使う箇所自体が無くなり、[0110](0110-security-operations.md) の禁止規定に対して「使っていない」ではなく「使える形になっていない」状態を作る
- **sanitizer の許可リストは inline `style` 属性を落とす。** 太字 / 斜体 / リスト / 見出し / リンクはいずれもクラスへ写像できるため、`style` を通す理由が無い。**この設計が成立することは実装で確認済みであり、リッチテキストを理由に CSP の `style-src-attr` へ `'unsafe-inline'` を開ける必要はない**([0111](0111-csp-security-headers.md) の enforce seam 判断の入力)。`class` / `id` も同様に落とす
- **editor が出せるタグ ⊆ sanitizer が通すタグ**を保つ。この包含関係が崩れると、入力できるのに保存後に落ちるという不整合が生じる。エディタの extension 集合は allowlist から導出し、**包含関係を test で固定して extension の追加が検知されるようにする**
- **XSS 規約との接続**: `dangerouslySetInnerHTML` の原則禁止と sanitizer 必須の**規約(rule)自体は [0110](0110-security-operations.md) が所有**(triage #48)。本 ADR は「sanitizer を差し替え可能な port として名前を付ける」構造側を敷き、規約は 0110 を正とする(二重決定しない)

### 4. モーダル/ダイアログ = a11y 契約が既定 + 実装手段は WAI-ARIA 準拠 primitive(#22)

- **modal が満たすべき a11y 契約を既定とする**([0100](0100-accessibility-target.md) WCAG 2.x AA):focus trap / Escape 閉じ / 背景 scroll lock / フォーカス復帰 / 名前と説明の関連付け。**実装手段ではなく契約を固定する**のは、契約が満たされるなら手段は差し替え可能だからである
- **overlay は、§1 の built-in 優先が届かない領域である。** native の modal 要素は top-layer と backdrop を供給するが、**背景の scroll lock・フォーカス復帰・開閉の宣言的な制御**は結局 component 側で補うことになり、補った結果は [0052](0052-ui-component-policy.md) が採る WAI-ARIA 準拠 primitive が既に供給しているものと同じになる。**契約を満たすために自前で補い直すのは再発明である**
- **これは built-in 優先の例外ではなく、その適用結果である。**「built-in で要件を満たせないと判明した時にのみライブラリ」(§1)という順序を実際に踏んだ結果が overlay の判定であり、単一 control・開閉・局所スクロールでは逆に built-in が勝つ。**領域ごとに判定し、片方の結論を全体へ広げない**
- 判定軸は「契約を満たすためにどれだけ補うか」である。補う量が無視できる面では native を採る
- **focus-trap / scroll-lock 等の UI 密着の挙動 hook は `capabilities` に上げず、その component に co-location する**([0022](0022-capabilities-kernel.md):runtime 能力ではなく UI 挙動のため)
- **route-as-modal(intercepting routes `(.)` / parallel routes `@modal`)の採否は本 ADR で確定しない**。これは URL 設計に波及するルーティング判断であり [0040](0040-routing-rendering-strategy.md) の管轄。0040 は現状 intercepting / parallel routes に未言及のため、採否は **0040 の追補で決める**(本 ADR で決めると管轄と齟齬する。§補足 / flag)

### 5. キーボードショートカット = 据え置き除外(#25)

- **グローバルキーボードショートカットは v1 / v2 とも採らない**(exclusion)。後付けで散在実装すると input フォーカス時の誤発火等の事故が起きるが、それは採る場合の話であり、本体は機構も置かない
- **登録機構(shortcut registry)の seam も置かない**。設置面(実使用箇所)が存在しない seam は敷かない方針のため、fork 先が採用する際に `capabilities` へ足す拡張点として名前だけを記録するに留める
- 個々の UI のキーボード操作性(タブ順序 / Enter・Escape 等)は a11y 契約の一部であり、[0100](0100-accessibility-target.md)(WCAG 2.x AA)を正とする。本項が除外するのは**グローバルショートカット機構**のみ
- **その component 自身の UI 内で完結するキー操作は例外で、component に置いてよい**(自身が出した領域へ focus を移す hotkey 等)。除外するのは、任意の操作を任意のキーへ結び付ける汎用の登録機構である
- **キー操作の「案内」を表示する部品は持てる。** 何が起きるかとどのキーかの対を表示する UI は、登録も `keydown` の待ち受けも持たない純粋な表示 primitive であり、機構ではない。ただし **`components` はこの案内が実際に効くことを担保できない** —— 案内部品と結線は層が違い(`components` は `capabilities` を import できない)、キーと handler を結ぶのは両方を import できる `features` 以上である。したがって**案内を載せた側が、そのキーで実行できることまでを負う**。キーボードから実行できない操作を案内に載せない

### 6. ドラッグ&ドロップ = 非同梱 + WCAG 2.2 ドラッグ代替 seam(#27)

- **DnD ライブラリ(dnd-kit 等)は v1 本体には同梱せず、[0052](0052-ui-component-policy.md) の区分で v2 局所ライブラリとして採用予定**である。まず native HTML Drag and Drop API を第一候補とする(§1)
- **ファイルのドロップは native API で満たせるため v1 で実装する。** 受け口を `input type="file"` の `label` として組めば、ドロップは加速手段になり、押下でも選択でき、`input` は tab で到達して Enter で開ける。落としたファイルは `input` の `files` へ書き戻し、native form の送信にも載せる。**ライブラリを要さずドラッグ代替を構造的に満たす**形であり、v2 待ちの対象ではない。ライブラリを要するのは並べ替え等の複雑な DnD である
- 採用する DnD は **WCAG 2.2 の Dragging Movements(SC 2.5.7)を満たす a11y 契約**を必須とする = **ドラッグ以外の単一ポインタ / キーボードによる代替操作を必ず提供する**。この「ドラッグ代替」を named seam として扱い、DnD を採る feature は代替経路の実装を伴う(a11y 契約なしの DnD は禁止。§禁止事項)
- DnD の挙動は UI 密着のため、focus-trap 同様に component co-location + feature 合成に置く([0022](0022-capabilities-kernel.md) の UI 挙動 hook 方針と同型)。a11y 目標は [0100](0100-accessibility-target.md)

### 7. 拡張点のコード実体化スコープ

拡張点は **設置面(実使用箇所)が実在する場合にのみコードとして実体化する**。空の IF / port 定義は置かない(使われない IF は腐り、実装時に必ず書き直されるため)。

- **sanitizer port は `model` カーネルに実体化済み**(§3)。エディタの採用により表示側の設置面が実在する
- **shortcut registry は置かない** — 設置面が無い(§5)。本 ADR は「名前 + 家 + a11y 契約」を記録し、fork 先が採用する時点で実体化する
- **DnD のドラッグ代替は、ライブラリを要さない範囲では component の実装として実体化済み**(§6)。ライブラリを要する DnD の代替 IF は、設置面が現れる v2 まで置かない

### 部品が持つ状態と、外から渡すもの

境界は **WAI-ARIA APG** が定める責務に合わせる。APG は role ごとに、キーボード操作と focus 管理を**部品の責務**として規定している。

| 部品が持つ | 外から渡す |
| --- | --- |
| 開閉 / ハイライトの位置 / focus の所在 / 入力途中の値 / 遷移中かどうか | 何を出すか(データ)/ できるか(可否)/ 押した結果に何が起きるか(action・callback) |

判定は **「見た目と操作の連続性のためだけに要る状態か」**である。業務の結果でしか決まらない値は外から渡す([0070](0070-backend-role-separation.md))。

**制御は既定で部品が持ち、必要になった呼び出しにだけ開ける。** `value` / `onChange` を最初から要求しない。これは HTML の入力要素が取る形であり、Control Props として定式化されている。挙動そのものを差し替える口(State Reducer)は設けない —— ライブラリ向けの機構であり、アプリ内の部品には過剰である。

### 1 つの操作に 1 つの role

**部品の粒度は role で決まる。** 1 つの要素が 2 つの操作を兼ねるなら、それは 2 つの部品である。支援技術から見えるのは role と accessible name だけであり、兼ねた操作は名前を 1 つしか持てない。

- **押しても移動しない `link` を作らない。** 移動しないなら `button` である(進めない導線は `button` の無効状態で表す)
- **押すと別の場所が開くものは `aria-expanded` を持つ。** 開閉の対象が自分の外にあるとき、それは操作であって表示ではない
- **記号だけの操作には accessible name を与える。** 同じ記号が並ぶ一覧では、名前に対象を含めて区別する

### 一度に見せる量は段階で絞る

情報と操作は**その時点で判断に要るものだけ**を出し、残りは次の段へ送る(progressive disclosure)。開閉・段階送り・詳細の展開はこの原則の実装であって、装飾ではない。

**隠してよいのは「後で決めればよいもの」だけ**である。可否・料金・取り消せるかどうかのように、**その場の判断を変える情報は隠さない**。折りたたむ場合も、閉じたままで判断が終わる要約を見出しに残す。

### 背面を塞ぐ overlay は、戻る操作で閉じる

被せて背面を塞ぐもの(dialog / alert dialog / sheet / drawer)は、**開いた時点で履歴を 1 つ積み、戻る操作で自分だけを閉じる**。閉じる操作で閉じたときは、積んだぶんを戻して履歴の増減を打ち消す。

理由は、**戻る操作の意味が「いま被さっているものを外す」だから**である。積まないと、被せたまま戻ったときに画面ごと前のページへ移る。読んでいた画面が消えるうえ、被せた側で入力していれば失われる。とくに触る操作の環境では、overlay を閉じる手段として最初に試されるのが戻る操作である。

**対象は背面を塞ぐものだけ**とする。popover / dropdown / tooltip / hover card は背面を塞がず、外側を触れば閉じる。これらまで履歴を積むと、戻る操作 1 回の意味が「どれか 1 つを閉じる」に薄まり、画面を戻れなくなる。

**画面を移す操作で閉じたときは、積んだぶんを戻さない。** 移った先から戻ったときに、閉じたはずの overlay が復活する。判定は積んだ時点の URL と履歴の印で行う。

**代わりに、overlay の中から画面を移すときは積み増しではなく置き換えで移る。** 積んだ 1 件は現在地の複製であり、戻り先として残すと戻る操作が 1 回空回りする(URL が変わらないため画面も動かない)。移る側が置き換えれば、その 1 件は移り先に上書きされて消える。link は `replace`、Server Action の `redirect` は `RedirectType.replace` を指定する。

### 構造の差し替えは props ではなく slot で受ける

利用側が中の構造を組み替える必要があるとき、**組み替えを props の分岐で表さない**。差し替える箇所を `children` か `asChild` として開ける。分岐で表すと、想定した組み合わせしか作れず、想定外が来るたびに props が増える。

**部品を親子に分ける(compound)のは、子が単独では意味を持たず、親が並び順と状態を決めるときだけ**である。子が単独で成立するなら、それは独立した部品であり、親は要らない。

## 禁止事項

- ❌ v2 局所ライブラリ区分の interaction UI(DnD 等)を、v2 を待たず **v1 本体へ前倒し同梱**すること([0052](0052-ui-component-policy.md) の v1/v2 区分に従う。複雑入力とリッチテキストは v1 採用済みのため本項の対象外)
- ❌ native / built-in(native input / `details` / `overflow` / native DnD API)で要件を満たせるのに、自前実装 / ライブラリで**再発明**すること(§1 built-in 優先を破る)
- ❌ 逆に、built-in で要件を満たせないと判明した領域で、契約を自前で補い直すこと(overlay の focus / scroll lock がこれに当たる。§4)
- ❌ 採用した interaction を **a11y 契約([0100](0100-accessibility-target.md))なしで実装**すること(modal の focus / scroll-lock / Escape、DnD の WCAG 2.2 ドラッグ代替、複雑入力のキーボード / ARIA)
- ❌ リッチテキスト表示で **sanitizer port を通さず** `dangerouslySetInnerHTML` を使うこと(規約の正は [0110](0110-security-operations.md))
- ❌ **route-as-modal(intercepting / parallel routes)の採否を本 ADR で確定**すること(ルーティング判断 = [0040](0040-routing-rendering-strategy.md) 管轄)
- ❌ focus-trap・scroll-lock・DnD 等の UI 密着挙動 hook を `capabilities` に上げること([0022](0022-capabilities-kernel.md):UI 挙動は component co-location)
- ❌ 設置面が無い拡張点(shortcut registry / DnD ドラッグ代替 IF)を、空の IF 定義としてコードに置くこと(§7)

## 補足

- **分類**([0140](0140-documentation-operations.md) タクソノミー): 本 ADR は a11y interaction seam(採用部品 / v2 局所ライブラリ共通の相互作用 a11y 契約 + 名前付き seam)を主とし、§4 の native `<dialog>` 既定という affirmative decision を内包する。いずれも ADR に属する分類(decision = ADR)であり、日常強制の粒度規約(rule)は 0110(XSS)/ 0100(a11y チェック)/ rules.md 側が持つ
- **0052 との主題分担**: [0052](0052-ui-component-policy.md) は「どの UI 部品を v1/v2 で持つか(採用・同梱可否)」を所有し、本 ADR は「持った / 持つ interaction UI の相互作用 a11y 品質(seam + 契約)」を所有する。両者は主題が重複しない
- **採番はブロック帯で確定(2026-07-14・0001〜0155(トピック順ブロック帯))**(独立起票)
- **採用区分**: リッチテキスト(TipTap)= **v1 採用**(§3)。DnD(dnd-kit)= v2 局所採用([master-plan §1.2](../plan/master-plan.md))。キーボードショートカット = 据え置き除外(§5)。いずれの場合も本体は seam と a11y 契約を保持し、ライブラリは [0010](0010-standards-and-non-lockin.md)(vendor-independent 正当化 + カーネル境界の裏で差替可能・vendor 直参照を feature/component に散らさない)/ [0004](0004-library-management.md)(exact-pin / `pnpm audit`)の枠内で置く。§1 built-in 優先と §3〜6 の a11y 契約は採用区分によらず不変

## 関連 ADR

- [0052-ui-component-policy.md](0052-ui-component-policy.md) — UI 部品の採用・同梱可否(shadcn/ui + Tabler アイコン + 複雑入力 + リッチテキスト = v1 / DnD = v2)。本 ADR はその部品が満たす相互作用 a11y 品質を別主題として所有する
- [0100-accessibility-target.md](0100-accessibility-target.md) — WCAG 2.x AA / biome a11y / 手動チェック(全 interaction の a11y 契約の正)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — route-as-modal(intercepting / parallel routes)採否の管轄(本 ADR では確定しない)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠 + 非ロックイン(§1 built-in 優先の vendor-independent 正当化の土台)
- [0022-capabilities-kernel.md](0022-capabilities-kernel.md) — UI 挙動 hook は component co-location という方針(グローバルショートカット機構は §5 で据え置き除外)
- [0111-csp-security-headers.md](0111-csp-security-headers.md) — sanitizer が `style` 属性を落とせるかが CSP enforce seam の判断入力になる(§3)
- [0110-security-operations.md](0110-security-operations.md) — XSS / sanitize 規約(`dangerouslySetInnerHTML` 禁止 + sanitizer 必須。sanitizer port の規約の正)
- [0050-styling-strategy.md](0050-styling-strategy.md) — Tailwind 主軸 + CSS Modules 限定許可(styled-components / emotion は非採用。採用 UI のスタイル手段)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — カーネル配置・命名規律・受入基準(sanitizer port / 表示 seam の物理配置の根拠)
- [0004-library-management.md](0004-library-management.md) — exact pin / audit(fork 先が interaction UI ライブラリを採る際の枠)

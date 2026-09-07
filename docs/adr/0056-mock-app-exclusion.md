# mock app の公開(exclusion)

契約から生成したモックを相手に動く本アプリ(mock app)を、**公開面として持たない**ことを意図的な除外(exclusion)として記録し、撤回する条件を示す。

mock app は別のアプリではない。同じアプリを `APP_API_MODE=mock` で起動したものが mock app であり、成果物は増えない。バックエンド無しで build が通り、起動して応答を返すことは CI の起動検査が見ており、画面を通した検証(e2e / 基準画像の比較)もこの形の上に乗る。**検証の土台としては本体に同梱する。公開しないのは、それを人に見せる面にすることである。**

## Status

Accepted (exclusion)

## 背景

このリポジトリが公開している面は 2 つで、どちらも**このリポジトリのドキュメント**である —— 部品のカタログ(Storybook。[0054](0054-ui-catalog-storybook.md))と、README を束ねた portal([0141](0141-portal-operations.md))。配信先は 1 つの静的サイトで、両者は兄弟の path に並ぶ。

mock app はどちらでもない。読み手に何かを説明するものではなく、検証のために画面を最後まで動かすための土台である。中身は契約から生成した値で、実在の業務を写していない。値域を設定で名指ししているのも、画面がその値で確かめられるようにするためであって、それらしく見せるためではない。

用途依存の「やらない」判断は、沈黙のままだと意識的に線引きした痕跡が残らない。i18n([0121](0121-i18n-strategy.md))/ PWA([0130](0130-pwa-strategy.md))と同じく、mock app の公開も exclusion として明文化する。

## 決定: mock app を公開面として持たない

- **mock app を Storybook / portal と並ぶ公開面にしない。** 配信サイトに mock app の tenant を足さず、デモとして URL を配らない
- **理由は、公開した瞬間にそれがデモになるからである。** 見た人はそれを製品の見本として読む。しかし中身は契約から生成した値であり、更新の責務を持つ主体が居ない。読み手へ何かを示す立場に無いものが、示す立場のものと並んで常設される
- **mock app が完全に動くのは、開発専用の口が開く環境だけである。** IdP を通らずに session を発行する口が無ければ、保護された画面へ到達できない。その口は `local` / `ci` でしか開かず、frontend だけを mock のまま cloud へ置く形は [0011](0011-no-docker.md) が既に禁じている。公開面にするには、その禁止を崩すか、認証の要る画面を諦めるかのどちらかになる
- **検証の土台としての同梱は変わらない。** CI の起動検査・e2e・基準画像の比較は mock app の上で走り続ける。exclusion の対象は「公開」であって「同梱」ではない

**却下した案: 常設デモとして公開する。** boilerplate の見本として画面を触れる場を用意する案。見本が要るなら、部品はカタログが、画面まるごとの姿は route と同じ器で包んだ story が既に持つ([0054](0054-ui-catalog-storybook.md))。触れる見本を別に立てると、そこに映るものの正が story と二重になる。

**却下した案: Storybook の中へ mock app を同居させる。** カタログは server の無い面であり、Server Action と Route Handler を差し替えて部品を見せる場である([0054](0054-ui-catalog-storybook.md))。アプリの経路を丸ごと載せると、差し替えの前提が崩れ、カタログが何を見せる場なのか分からなくなる。

## 撤回条件

公開へ倒すのは、**mock app 自身が読み手へ何かを示す立場になったとき**である。たとえば、画面の仕様を見せる面として使うと決めたとき。そのときは次の 2 つが同時に決まっていなければならない。

- **何を示す面か。** 仕様の見本なのか、操作の手触りを見せる場なのか。示すものが決まらないまま公開すると、見た人が勝手に意味を与える
- **誰が更新の責務を持つか。** 契約が変われば生成物は自動で変わるが、「示している内容が正しいか」は生成では担保されない。その責務を持つ主体が無いなら、示す立場には立てない

条件が揃ったときの置き場は、配信サイトの兄弟 path([0141](0141-portal-operations.md) §4)である。そのときも [0011](0011-no-docker.md) の禁止は残る —— 公開する mock app は開発専用の口を閉じた build であり、認証の要る画面へどう到達させるかを別に決めることになる。

## exclusion の扱い

- 本 ADR は「意図的にやらない」判断の記録である([0140](0140-documentation-operations.md) タクソノミー: exclusion = ADR)。fork 先が自分の判断で mock app を公開する分には、この exclusion は障害にならない

## 禁止事項

- ❌ 配信サイトに mock app の tenant を足すこと、または mock app の URL をデモとして配ること(撤回条件が揃うまで)
- ❌ mock app を「見本」として README や portal から案内すること(見本は Storybook の story が持つ。[0054](0054-ui-catalog-storybook.md))
- ❌ 公開のために、開発専用の口が開いたままの build を手元の宛先以外へ置くこと([0011](0011-no-docker.md) / [0113](0113-development-access-surface.md))

## 関連 ADR

- [0054-ui-catalog-storybook.md](0054-ui-catalog-storybook.md) — 公開面の 1 つ(部品のカタログ)。画面まるごとの見本も story が持つ
- [0141-portal-operations.md](0141-portal-operations.md) — 公開面の 1 つ(README の portal)と、配信サイトの構成
- [0011-no-docker.md](0011-no-docker.md) — frontend だけを mock のまま cloud へ置かない、開発専用の口が開く環境の定義
- [0113-development-access-surface.md](0113-development-access-surface.md) — 開発専用の口が build と実行時の両方で閉じること
- [0090-testing-strategy.md](0090-testing-strategy.md) / [0091-test-verification-methods.md](0091-test-verification-methods.md) — mock app の上で走る検証
- [0121-i18n-strategy.md](0121-i18n-strategy.md) / [0130-pwa-strategy.md](0130-pwa-strategy.md) — 用途依存を exclusion 記録する同型の判断

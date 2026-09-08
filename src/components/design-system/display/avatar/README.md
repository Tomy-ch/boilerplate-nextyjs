# Avatar

## 用途

利用者や組織を小さな円形で識別しやすくします。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Avatar` | 画像と代替表示を切り替える client-side root です。`size` で表示サイズを選びます。 |
| `AvatarImage` | 読み込みに成功したときだけ表示される画像です。 |
| `AvatarFallback` | 画像が表示できないときの代替表示です。頭文字や icon を置きます。 |
| `AvatarBadge` | avatar の右下へ重ねる小さな標識です。 |
| `AvatarGroup` | 複数の avatar を少し重ねて並べます。 |
| `AvatarGroupCount` | `AvatarGroup` の末尾に置く、表示しきれない人数の表示です。 |

`AVATAR_SIZE` は `avatar.definition.ts` が owner です。`default` / `sm` / `lg` の三値で、`AvatarGroupCount` の大きさは group 内の `size` に追従します。

## 利用ケース

一覧の行、マイページ、コメントや履歴の発言者など、人物や組織を繰り返し示す場面に使います。

## MediaImage との使い分け

| | 使う場面 |
| --- | --- |
| `Avatar` | 人物・組織の識別。円形に切り抜き、読み込み失敗時は頭文字などへ切り替える |
| `MediaImage` | 内容としての画像。比率を固定し、読み込み中は Skeleton を出す |

切り替えの有無が分かれ目です。`Avatar` は読み込み結果に応じて表示を差し替えるため hydration が必要な client island、`MediaImage` は差し替えを持たない SSR first の Server Component です。読み込み結果で表示を変えないなら `Avatar` を使いません。

## 責務境界

画像の取得元、代替表示の文字列（頭文字の作り方）、標識が示す状態、group に何人ぶん表示するかの判断は持ちません。いずれも呼び出し元が決めて props として渡します。

avatar そのものは識別の補助です。誰を指すかは隣接する氏名などの文言が伝えるので、avatar だけで人物を特定させる設計にしません。

vendor は現在 Radix です。

## アクセシビリティ

`alt` は呼び出し元が必ず指定します。隣に氏名を表示していて avatar が装飾に留まる場合は `alt=""` とし、avatar だけが人物を示す場合は誰かが分かる文言を渡します。`AvatarFallback` に `AvatarImage` の `alt` と同じ情報を書くと、切り替わった際に同じ情報が二重に伝わります。

`AvatarBadge` は色や点だけでは意味が伝わりません。状態を伝える必要がある場合は `sr-only` の文言を子に置くか、隣接する文言で補います。

## Storybook とテスト

Storybook は読み込み成功時、代替表示、サイズ一覧、標識つき、group と残数表示、avatar 単体で人物を示す場合を確認します。テストは読み込み前後の切り替え、読み込み失敗時に代替表示のままになること、空の `alt` で読み上げ対象から外れること、`size` の data 属性、標識と group の構成、a11y 自動検査を確認します。

jsdom は画像を実際に取得しないため、テストでは `Image` を差し替えて読み込み結果だけを再現します。Radix は `addEventListener` と `complete` / `naturalWidth` で状態を判定するため、stub もその形に合わせます。実装から画像取得の依存を取り除く方向では対処しません。

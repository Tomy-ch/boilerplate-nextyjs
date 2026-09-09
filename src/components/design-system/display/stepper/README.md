# Stepper

## 用途

既知で有限の段階を定義順に並べ、現在位置とまだ到達していない先を示します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Stepper` | 段階を並べる `ol` です。進捗の名前を `label`、並べる向きを `orientation` で受け取ります。 |
| `StepperItem` | 段階 1 つです。`state` で位置を示し、`current` へ `aria-current="step"` を与えます。 |

`STEPPER_STATE`（`complete` / `current` / `upcoming`）・`STEPPER_STATE_LABEL`・`STEPPER_ORIENTATION`（`vertical` / `horizontal`）・`STEPPER_PASSED_CURRENT_LABEL` は `stepper.definition.ts` が owner です。

内容は [`List`](../list/README.md) の `ListItemContent` / `ListItemTitle` / `ListItemDescription` で組み立てます。縦に並ぶ行・先頭の印・見出しと説明は `List` が既に持つため、同じものを作り直していません。

**向きは既定で縦です。**`orientation` に `horizontal` を与えると横並びになり、入りきらない分は折り返します。段の数が少なく、名前が短いときに、入力欄の上へ進捗を置けます。どちらの向きでも組み立てる要素は同じで、変わるのは並べ方だけです。

## 利用ケース

申請・登録・承認のように、**段階があらかじめ決まっている**進捗の表示に使います。

```tsx
<Stepper label="申請の進捗">
  <StepperItem marker={1} state={STEPPER_STATE.COMPLETE}>
    <ListItemContent>
      <ListItemTitle>申請</ListItemTitle>
    </ListItemContent>
  </StepperItem>
</Stepper>
```

## 責務境界

**段階の定義・遷移可否・次に取れる操作は持ちません。** どこまで進んだかを決めるのは呼び出し元で、この component は渡された `state` を描くだけです。

`ActivityTimeline` とは別部品です。縦に項目が並ぶ見た目は似ていますが、前提が違います。

| | `Stepper` | `ActivityTimeline` |
| --- | --- | --- |
| 対象 | 既知で有限の段階 | 未知の件数の履歴 |
| 焦点 | 現在位置と、まだ到達していない先 | 過去に起きたこと |
| 順序 | 定義順。増減しない | 時刻順。増え続ける |
| 意味論 | `ol` + `aria-current="step"` | `ol`。`role="feed"` は持たない |

**「次に取れる操作」と pagination は同居しません。** 前者は有限の段階を、後者は無限の履歴を前提にするため、1 部品へ入れるとどちらの前提でも破綻します。

**`current` は 1 つの `Stepper` の中で 1 つだけにします。** 複数あると現在地が定まりません。

**済ませたことと、今どこに居ることは別の事実です。** 一度通った段へ戻ると `current` に戻りますが、入力そのものは済んでいます。`passed` を与えると印だけが `complete` と同じ check になり、`state` は `current` のまま残ります。読み上げには `STEPPER_PASSED_CURRENT_LABEL`（既定「現在の段階・完了」）が出ます。`state` の側を `complete` にして代用しないでください —— 現在地が消えます。

**進捗の名前を必ず与えます。** 同じ画面に複数の進捗があるとき、名前が無いとどちらの進捗か判りません。

印は装飾です。`complete` では check、それ以外では `marker` に渡した番号を出します。**色と印だけでは支援技術へ伝わらない**ため、状態を表す語を読み上げ専用のテキストとして各段階に添えています。

この語は既定で「完了 / 現在の段階 / 未着手」（`STEPPER_STATE_LABEL`）ですが、`StepperItem` の `stateLabel` で差し替えられます。「承認済み」「差し戻し」のように段階の呼び名が決まっている場合に寄せてください。**空文字にすると状態が伝わらなくなる**ため、置き換えるなら別の語を与えます。

`STEPPER_STATE` は `data-state` 属性へ出る識別子、`STEPPER_STATE_LABEL` は読み上げられる文言で、役割が違います。

Server Component として使えます。hydration は不要です。

## Storybook とテスト

Storybook は途中まで進んだ状態、まだ始まっていない状態、すべて通過した状態、説明を持たない場合、番号を持たない場合、状態の語を段階の呼び名へ差し替えた場合を確認します。差し替えは読み上げ専用のため見た目には現れず、実挙動はテストで固定しています。テストは `ol` として名前つきで並ぶこと、現在地だけへ `aria-current` を与えること、状態を読み上げ用の語でも示すこと、通過済みが番号ではなく check になること、現在地であっても `passed` なら印と読み上げの両方でそれを示すこと、`state` を省くと未着手になること、`stateLabel` で語を差し替えられること、`marker` を省いても印の枠が残ること、横に並べる指定が属性にも出ること、操作を持たないこと、a11y 自動検査を確認します。

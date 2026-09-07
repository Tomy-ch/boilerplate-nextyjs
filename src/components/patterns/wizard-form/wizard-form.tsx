"use client";

import type { ReactNode } from "react";
import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/components/cn";
import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { ListItemContent, ListItemTitle } from "@/components/design-system/display/list/list";
import { Stepper, StepperItem } from "@/components/design-system/display/stepper/stepper";
import {
  STEPPER_ORIENTATION,
  STEPPER_STATE,
} from "@/components/design-system/display/stepper/stepper.definition";
import { useLatched } from "@/components/use-latched";

/** 入力の段階 1 つ。 */
export type WizardStep = {
  /** 段階を識別する値。 */
  id: string;
  /** 進捗と見出しに出す段階の名前。 */
  title: string;
  /** この段階で入力する内容。 */
  content: ReactNode;
  /** この段階を終えられないか。次へ進む操作を押せなくする。 */
  blocked?: boolean;
  /**
   * この段階から次へ進む操作の文言。
   *
   * @remarks
   * 省略すると全体の既定を使います。行き先が「次の段階」以上のことを意味する段階でだけ与えます
   * （最後の 1 つ手前が確認へ進む、など）。
   */
  nextLabel?: string;
};

/**
 * 段階の並び。1 件以上を型で要求する。
 *
 * 段階が 0 件の wizard は表示するものが無く、先頭要素を読んだ時点で壊れるため、渡せない
 * 状態にしておく。
 */
export type WizardSteps = readonly [WizardStep, ...WizardStep[]];

/**
 * 到達済みの段階へ移る操作。
 *
 * @remarks
 * 段階ごとに切り出すのは、行き先を閉じ込めた handler を段階の数だけ作らないためです。
 */
function WizardStepLink({
  disabled,
  index,
  onSelect,
  title,
}: {
  disabled: boolean;
  index: number;
  onSelect: (index: number) => void;
  title: string;
}) {
  const select = useCallback(() => onSelect(index), [index, onSelect]);

  return (
    <button
      className="cursor-pointer underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      disabled={disabled}
      onClick={select}
      type="button"
    >
      {title}
    </button>
  );
}

/** {@link WizardForm} の props。 */
export type WizardFormProps = {
  /** この入力全体のアクセシブルな名前。 */
  label: string;
  /** 段階の定義。並び順がそのまま進む順になる。 */
  steps: WizardSteps;
  /** 最後の段階で「次へ」の代わりに置く操作。送信は呼び出し元が持つ。 */
  submit: ReactNode;
  /** 前の段階へ戻る操作の文言。 */
  previousLabel?: string;
  /** 次の段階へ進む操作の文言。 */
  nextLabel?: string;
  /** 外枠の class。 */
  className?: string;
};

/**
 * 複数段階に分けた入力の枠を提供する client island。
 *
 * @remarks
 * 持つのは**今どの段階に居るかと、その行き来だけ**である。各段階の field、検証規則、送信、途中
 * 保存はいずれも呼び出し元が持つ。進めてよいかは `blocked` として渡す。
 *
 * **到達した段階は DOM へ残し、現在以外を `hidden` で隠す。** unmount すると `<form action>` で
 * 送信したときにその段の入力値が送られない。`hidden` なら値は form に残ったまま、支援技術と
 * layout からは外れる。
 *
 * 最後の段階で置く操作と「次へ」には別々の `key` を与える。同じ位置の `button` として reconcile
 * されると React が DOM 要素を使い回し、押した瞬間に `type` が `button` から `submit` へ書き換わる。
 * click の既定動作は handler の後に走るため、進んだうえで form まで送信されてしまう。
 *
 * **一度でも到達した段階へは進捗から直接行ける。** 順に辿り直させる理由が無く、確認の段から
 * 1 か所だけ直しに行く動きが最短で済む。まだ到達していない段階は押せない —— 進んでよいかの判定
 * は呼び出し元の `blocked` が持っており、飛ばして到達できると、その判定を迂回できてしまう。
 *
 * 印（通過済みかどうか）と押せるかどうかは別の条件で決まる。**到達しただけで通過はしていない
 * 段階**があるためで、そこへは行けるが印は付かない。逆に、済ませた段階へ戻ったときは現在地に
 * なっても印を残す —— 済ませたことと今どこに居るかは別の事実で、印が消えると済ませた入力まで
 * 無かったことになったように見える。
 *
 * **今の段階を終えられないあいだは、先へは進捗からも行けない。** 「次へ」だけを止めても、
 * 進捗から飛べては同じことになる。前へ戻る側は止めない —— 戻ることはその段階を済ませたと
 * 主張しないため。
 *
 * 段階が変わったら、その段階の領域へ focus を移す。移さないと操作した button に focus が残り、
 * keyboard と読み上げの利用者には何が変わったのか伝わらない。最初の表示では移さない。
 *
 * 進捗の表示は `Stepper` を合成し、**横に並べる**。段階の並びと現在位置の意味論はそちらが持つ。
 * 縦へ積むと、段階の数だけ入力欄より上が伸び、入力を始める前に画面を送ることになる。
 *
 * @example
 * ```tsx
 * <WizardForm
 *   label="利用申請"
 *   steps={[
 *     { id: "applicant", title: "申請者", content: <ApplicantFields /> },
 *     { id: "confirm", title: "確認", content: <Confirmation /> },
 *   ]}
 *   submit={<Button type="submit">申請する</Button>}
 * />
 * ```
 *
 * @param props.label - この入力全体のアクセシブルな名前。
 * @param props.steps - 段階の定義。
 * @param props.submit - 最後の段階で置く操作。
 *
 * @see Storybook `Form/WizardForm`
 */
export function WizardForm({
  label,
  steps,
  submit,
  previousLabel = "戻る",
  nextLabel = "次へ",
  className,
}: WizardFormProps) {
  // 現在地と最も先まで進んだ位置を 1 つの状態で持つ。別々に持って片方の更新関数の中でもう片方を
  // 更新すると、更新関数が再実行されたときに副作用も繰り返され、進んでいない段まで到達済みに
  // なる。更新関数は状態から次の状態を返すだけにする。
  const [progress, setProgress] = useState({ currentIndex: 0, furthestIndex: 0 });
  const { currentIndex, furthestIndex } = progress;
  const panelId = useId();
  const movedRef = useRef(false);
  // 段が減って現在地が並びの外へ出たら、先頭の段を現在地とみなす。
  const current = steps[currentIndex] ?? steps[0];
  const currentPanelId = `${panelId}-${current.id}`;

  // 段階が変わったときだけ focus を移す。最初の表示で移すと、開いた直後に読み上げが飛ぶ。
  useEffect(() => {
    if (!movedRef.current) return;

    document.getElementById(currentPanelId)?.focus();
  }, [currentPanelId]);

  const goPrevious = useCallback(() => {
    movedRef.current = true;
    setProgress((moved) => ({ ...moved, currentIndex: Math.max(0, moved.currentIndex - 1) }));
  }, []);

  const goNext = useCallback(() => {
    movedRef.current = true;
    setProgress((moved) => {
      const next = Math.min(steps.length - 1, moved.currentIndex + 1);

      return { currentIndex: next, furthestIndex: Math.max(moved.furthestIndex, next) };
    });
  }, [steps.length]);

  /**
   * その段へ移れるか。
   *
   * 到達済みで、いま居る段ではなく、いま居る段を終えられているなら移れる。前へ戻る側は
   * 終えられていなくても移れる —— 戻ることは、その段を済ませたと主張しないため。
   *
   * **`index <= furthestIndex` を緩めると、飛ばした段が mount されないまま送信される。**
   * 段を DOM へ残すかは `StepPanel` が「一度でも現在地だったか」で決めており、ここが 1 段ずつ
   * しか進ませないことがその判断の前提になっている。
   */
  const canGoTo = useCallback(
    (index: number) =>
      index <= furthestIndex &&
      index !== currentIndex &&
      !(current.blocked === true && index > currentIndex),
    [current.blocked, currentIndex, furthestIndex],
  );

  // 規則は `canGoTo` が 1 か所で持ち、進捗はそれを消費して押せるかを決める。ここで再び
  // 検査しないのは、押せない段の操作が DOM に無い以上その枝へ到達できず、通らない分岐が残る
  // ためである。規則を足すときは `canGoTo` を直せば描画と挙動の両方が追随する。
  const goTo = useCallback((index: number) => {
    movedRef.current = true;
    setProgress((moved) => ({ ...moved, currentIndex: index }));
  }, []);

  const isLast = currentIndex === steps.length - 1;

  return (
    <div className={cn("flex flex-col gap-6", className)} data-slot="wizard-form">
      <Stepper label={`${label}の進捗`} orientation={STEPPER_ORIENTATION.HORIZONTAL}>
        {steps.map((step, index) => (
          <StepperItem
            key={step.id}
            marker={index + 1}
            passed={index < furthestIndex}
            state={stepState(index, currentIndex, furthestIndex)}
          >
            <ListItemContent>
              <ListItemTitle>
                {index <= furthestIndex && index !== currentIndex ? (
                  <WizardStepLink
                    disabled={!canGoTo(index)}
                    index={index}
                    onSelect={goTo}
                    title={step.title}
                  />
                ) : (
                  step.title
                )}
              </ListItemTitle>
            </ListItemContent>
          </StepperItem>
        ))}
      </Stepper>

      {steps.map((step, index) => (
        <StepPanel
          active={index === currentIndex}
          id={`${panelId}-${step.id}`}
          key={step.id}
          title={step.title}
        >
          {step.content}
        </StepPanel>
      ))}

      <div
        className="flex flex-wrap items-center justify-end gap-2"
        data-slot="wizard-form-actions"
      >
        <Button
          disabled={currentIndex === 0}
          onClick={goPrevious}
          type="button"
          variant={BUTTON_VARIANT.OUTLINE}
        >
          {previousLabel}
        </Button>
        {isLast ? (
          <Fragment key="submit">{submit}</Fragment>
        ) : (
          <Button disabled={current.blocked} key="next" onClick={goNext} type="button">
            {current.nextLabel ?? nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * 進捗に出す段階の状態。
 *
 * @remarks
 * 通過したことは **`currentIndex` ではなく `furthestIndex` で見る**。現在地だけで決めると、前へ
 * 戻った時点で通過済みの印が消え、済ませた入力までやり直しに見える。
 */
function stepState(index: number, currentIndex: number, furthestIndex: number) {
  if (index === currentIndex) return STEPPER_STATE.CURRENT;
  if (index < furthestIndex) return STEPPER_STATE.COMPLETE;

  return STEPPER_STATE.UPCOMING;
}

/**
 * 段階 1 つぶんの領域。
 *
 * 現在の段階以外も DOM へ残すため、`hidden` で隠す。form の値を保つのが目的なので、
 * `display: none` を class で当てるのではなく属性で隠す。
 *
 * 段階は form control の集合なので `fieldset` で表し、段階名を `legend` として与える。
 *
 * focus は移すが輪は描かない。操作した直後に中身が目に見えて変わるため、輪が足す情報が無く、pointer で操作した人には押した場所と無関係な枠が現れることになる。行き先は要素の名前が伝える。`legend` は
 * flex の流れから外れて描かれるため `gap` が効かない。段階名と最初の入力が詰まらないよう、
 * `legend` 自身へ下の余白を持たせる。
 */
function StepPanel({
  active,
  children,
  id,
  title,
}: {
  active: boolean;
  children: ReactNode;
  id: string;
  title: string;
}) {
  // 到達済みかは「一度でも現在地だったか」と同じである —— 次へは 1 段ずつしか進まず、飛べる先も
  // 到達済みに限られるため、先の段が現在地を飛ばして開くことがない。
  const reached = useLatched(active);

  return (
    <fieldset
      className="flex min-w-0 flex-col gap-3 outline-hidden"
      data-slot="wizard-form-step"
      hidden={!active}
      id={id}
      tabIndex={-1}
    >
      <legend className="mb-3 font-emphasis text-base">{title}</legend>
      {reached ? children : null}
    </fieldset>
  );
}

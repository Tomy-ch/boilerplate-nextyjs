import type { ReactNode } from "react";

const DEFAULT_TOAST_VARIANT = "default";
const WARNING_TOAST_VARIANT = "warning";
const DESTRUCTIVE_TOAST_VARIANT = "destructive";

/**
 * 通知の意味づけ。
 *
 * - `default`: 成功や完了の報告
 * - `warning`: 処理は進んだが利用者の確認が要る状態
 * - `destructive`: 失敗の報告
 *
 * `destructive` だけが支援技術へ割り込んで読み上げられる。ほかは読み上げ中の内容を
 * 妨げずに順番を待つ。
 *
 * @see Storybook `Feedback/Toaster`
 */
export const TOAST_VARIANT: Readonly<{
  DEFAULT: "default";
  WARNING: "warning";
  DESTRUCTIVE: "destructive";
}> = {
  DEFAULT: DEFAULT_TOAST_VARIANT,
  WARNING: WARNING_TOAST_VARIANT,
  DESTRUCTIVE: DESTRUCTIVE_TOAST_VARIANT,
};

/** {@link TOAST_VARIANT} のいずれか。 */
export type ToastVariant = (typeof TOAST_VARIANT)[keyof typeof TOAST_VARIANT];

/**
 * 通知を積む画面の隅。
 *
 * 縦は読み上げ順や主導線との重なり、横は利き手や既存 UI との衝突で選ぶ。画面ごとに
 * 変えると通知の出所が定まらないため、アプリで一つに決める。
 *
 * @see Storybook `Feedback/Toaster`
 */
export const TOAST_POSITION: Readonly<{
  TOP_LEFT: "top-left";
  TOP_CENTER: "top-center";
  TOP_RIGHT: "top-right";
  BOTTOM_LEFT: "bottom-left";
  BOTTOM_CENTER: "bottom-center";
  BOTTOM_RIGHT: "bottom-right";
}> = {
  TOP_LEFT: "top-left",
  TOP_CENTER: "top-center",
  TOP_RIGHT: "top-right",
  BOTTOM_LEFT: "bottom-left",
  BOTTOM_CENTER: "bottom-center",
  BOTTOM_RIGHT: "bottom-right",
};

/** {@link TOAST_POSITION} のいずれか。 */
export type ToastPosition = (typeof TOAST_POSITION)[keyof typeof TOAST_POSITION];

/** 位置を指定しない場合に積む隅。 */
export const DEFAULT_TOAST_POSITION: ToastPosition = TOAST_POSITION.BOTTOM_RIGHT;

/**
 * 同時に表示する通知の上限の既定値。
 *
 * 通知は画面の隅を占有し続けるため、上限が無いと連続した失敗で操作面が覆われる。
 * 超えた分は queue に残り、表示中の通知が閉じると現れる。
 */
export const DEFAULT_VISIBLE_TOASTS = 3;

/** 残り時間を測り直す間隔（ミリ秒）。 */
export const TOAST_TICK_INTERVAL_MS = 100;

/** swipe で閉じたと判定する移動量（ピクセル）。 */
export const TOAST_SWIPE_THRESHOLD_PX = 64;

/** 畳んだ状態で、後ろの通知を覗かせる量（ピクセル）。 */
export const TOAST_STACK_OFFSET_PX = 10;

/** 畳んだ状態で、後ろの通知を 1 枚ごとに縮める割合。 */
export const TOAST_STACK_SCALE_STEP = 0.05;

/**
 * 通知の領域へ focus を移すキー操作。
 *
 * 修飾キーの既定は `Alt`、キーは `T`。`code` は物理キーであり、キーボード配列が変わっても
 * 同じ位置のキーを指す。
 */
export type ToastHotkey = {
  /** `KeyboardEvent.code`。 */
  code: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

/** 指定しない場合に通知の領域へ focus を移すキー操作。 */
export const DEFAULT_TOAST_HOTKEY: ToastHotkey = { altKey: true, code: "KeyT" };

/**
 * 通知から直接実行できる操作。
 *
 * @remarks
 * 「元に戻す」「再試行」のように、通知を読んだ直後にしか意味を持たない操作だけを置く。
 * 通知は数秒で消えるため、ここにしか到達手段が無い操作を置いてはならない。
 */
export type ToastAction = {
  /** 操作を表す短い文言。 */
  label: string;
  /** 選択されたときに実行する処理。実行後、通知は閉じる。 */
  onClick: () => void;
};

/**
 * 表示に必要な値だけを運ぶ通知 1 件。
 *
 * @remarks
 * queue の生成・並び替え・削除は Provider か feature が所有する。
 */
export type Toast = {
  /** 通知を識別する値。React の key にも使われるため queue 内で一意にする。 */
  id: string;
  /** 何が起きたかを一行で示す見出し。 */
  title: string;
  /** 見出しを補う説明。 */
  description?: ReactNode;
  /** 通知の意味づけ。値の一覧は {@link TOAST_VARIANT}。 */
  variant?: ToastVariant;
  /** 0 より大きい場合、このミリ秒後に自動で閉じる。省略すると利用者が閉じるまで残る。 */
  duration?: number;
  /** 通知から直接実行できる操作。 */
  action?: ToastAction;
};

/** 表示中の通知へ後から当てられる差分。`id` は変えられない。 */
export type ToastPatch = Partial<Omit<Toast, "id">>;

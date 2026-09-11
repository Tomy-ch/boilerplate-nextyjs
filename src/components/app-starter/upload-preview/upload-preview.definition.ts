import type { ReactNode } from "react";

import type { AttachmentState } from "@/components/app-starter/attachment/attachment.definition";

/**
 * 表示に必要な値だけを運ぶ、選択中のファイル 1 件。
 *
 * @remarks
 * 送信経路・保存先・業務上の意味は持たない。名前と説明は整形済みの文言として受け取り、書式は
 * 決めない。
 */
export type UploadPreviewItem = {
  /** 一覧の中で一意な識別子。操作の callback へそのまま渡る。 */
  id: string;
  /** 利用者へ見せるファイル名。 */
  name: string;
  /** 大きさや進行状況など、名前を補う一文。進行中や失敗は `state` だけでなくここでも示す。 */
  description?: ReactNode;
  /** 今どの段階にあるか。見た目だけを変える。 */
  state?: AttachmentState;
  /**
   * 画像として見せる元。
   *
   * `File` を渡すと、表示用の URL の生成と破棄を {@link UploadPreviewItem} を描画する側が
   * 引き受ける。送信済みで URL が判っている場合は文字列を渡す。省略すると画像を出さない。
   */
  preview?: File | string;
};

/** 選択中のファイルの並べ方。 */
export const UPLOAD_PREVIEW_ORIENTATION = {
  /** 縦の一覧。件ごとの補足まで読ませたい場合に使う。 */
  LIST: "list",
  /** 横の束。件数が増えても縦を取らせたくない場合に使う。 */
  ROW: "row",
} as const;

/** 並べ方の値。 */
export type UploadPreviewOrientation =
  (typeof UPLOAD_PREVIEW_ORIENTATION)[keyof typeof UPLOAD_PREVIEW_ORIENTATION];

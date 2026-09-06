"use client";

import {
  type ChangeEvent,
  type ComponentProps,
  type DragEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";

import { cn } from "@/components/cn";
import { UploadIcon } from "@/components/icon";
import { ProgressClient } from "../../design-system/status/progress-client/progress-client";
import { FILE_UPLOAD_REJECTION_REASON, type FileUploadRejection } from "./file-upload.definition";

/** {@link FileUpload} の props。 */
export type FileUploadProps = Omit<ComponentProps<"input">, "onSelect" | "type" | "value"> & {
  /** 受け付ける最大の大きさ（byte）。省略すると大きさで弾かない。 */
  maxSize?: number;
  /** 送信中か。操作を止める。 */
  pending?: boolean;
  /** 送信の進捗（0 以上 100 以下）。省略すると進捗を表示しない。 */
  progress?: number;
  /** 領域に添える誘導文。 */
  prompt?: string;
  /** 選ぶ操作の文言。 */
  triggerLabel?: string;
  /**
   * 選択された内容を伝える。受け付けたものだけが渡る。
   */
  onSelect?: (files: File[]) => void;
  /**
   * 渡し終えたら受け口を空へ戻すか。
   *
   * @remarks
   * 選んだ内容の持ち主が呼び出し元にある場合に使います。受け口が自分の控えを持ち続けると、
   * 呼び出し元が 1 件外しても受け口の表示は変わらず、同じファイルが 2 か所に食い違って
   * 並びます。空へ戻せば持ち主は 1 つになります。
   *
   * 同じファイルを選び直せるようにもなります。`input` は値が変わらないと `change` を出さない
   * ため、控えを残したままだと一度外したファイルを選び直せません。
   */
  resetOnSelect?: boolean;
  /** 受け付けなかったファイルと、その理由を伝える。 */
  onReject?: (rejections: FileUploadRejection[]) => void;
};

function matchesAccept(file: File, accept: string | undefined) {
  if (accept === undefined || accept.trim() === "") {
    return true;
  }

  return accept.split(",").some((rule) => {
    const pattern = rule.trim().toLowerCase();

    if (pattern === "") {
      return false;
    }

    if (pattern.startsWith(".")) {
      return file.name.toLowerCase().endsWith(pattern);
    }

    if (pattern.endsWith("/*")) {
      return file.type.toLowerCase().startsWith(pattern.slice(0, -1));
    }

    return file.type.toLowerCase() === pattern;
  });
}

function rejectionOf(
  file: File,
  accept: string | undefined,
  maxSize: number | undefined,
): FileUploadRejection | null {
  if (!matchesAccept(file, accept)) {
    return { file, reason: FILE_UPLOAD_REJECTION_REASON.TYPE };
  }

  if (maxSize !== undefined && file.size > maxSize) {
    return { file, reason: FILE_UPLOAD_REJECTION_REASON.SIZE };
  }

  return null;
}

/**
 * ファイルを選ぶ form control。
 *
 * @remarks
 * 送信前に形式と大きさを確かめ、受け付けた分だけを `onSelect` へ、弾いた分を理由つきで
 * `onReject` へ渡す。選択の保持と検証のために hydration が必要な client island であり、
 * Server Component からは直接 render できない。
 *
 * **drop は加速手段であり、唯一の経路にしない。** ドラッグは pointer を持つ環境でしか使えず、
 * touch にも keyboard にも効かない。領域全体が `input` の `label` なので、どこを押しても選択
 * ダイアログが開き、`input` 自体は tab で到達して Enter で開ける。WCAG 2.5.7 が求めるドラッグ
 * 操作の代替はこれで満たす。
 *
 * 領域の文言は `input` のアクセシブルな名前にも加わる。`Field` の `FieldLabel` と併せると名前が
 * 連なるため、`prompt` と `triggerLabel` は短い語にする。
 *
 * **送信経路を持たない。** 実際の送信が presigned な直 PUT か multipart の proxy かをこの
 * component は知らない。送信中かどうかは `pending`、進捗は `progress`、完了後の識別子の扱いは、
 * すべて呼び出し元が props と callback で受け渡す。
 *
 * **エラーの文言を持たない。** `onReject` が渡すのは弾いたファイルと理由の組だけで、利用者へ
 * 見せる文言は呼び出し元が組み立て、`FieldError` として表示する。`aria-invalid` も呼び出し元が
 * 決める。server 側の検証結果と client 側の検証結果を一箇所で扱うためである。
 *
 * **preview・選択済みの削除は持たない。** ここで表示するのは受け付けたファイルの名前だけで、
 * それ以上の組み立ては上位の composition が担う。
 *
 * 落としたファイルは `input` の `files` へ書き戻すため、native form の送信にもそのまま載る。
 * `multiple` を指定しない場合、複数を落としても先頭の 1 件だけを受け付ける。
 *
 * native の下地は `Field` と `Input type="file"` の組み合わせで、Server Action による検証だけで
 * 足りる場合はそちらを使う。
 *
 * @example
 * ```tsx
 * <Field>
 *   <FieldLabel htmlFor={fieldId}>添付画像</FieldLabel>
 *   <FileUpload
 *     accept="image/png,image/jpeg"
 *     aria-invalid={message !== null}
 *     id={fieldId}
 *     maxSize={2 * 1024 * 1024}
 *     name="image"
 *     onReject={handleReject}
 *     onSelect={handleSelect}
 *     pending={isPending}
 *   />
 *   {message === null ? null : <FieldError>{message}</FieldError>}
 * </Field>
 * ```
 *
 * @param props - native `input` 属性から `type` / `value` / `onSelect` を除いたものに、上記を
 *   加えたもの。`accept` と `multiple` はそのまま native の属性として働き、検証にも使われる。
 * @see Storybook `Form/FileUpload`
 */
export function FileUpload({
  accept,
  className,
  disabled,
  id,
  maxSize,
  multiple,
  onChange,
  onReject,
  onSelect,
  resetOnSelect,
  pending = false,
  progress,
  prompt = "ここにドラッグ、またはクリックして選択",
  triggerLabel = "ファイルを選択",
  ...props
}: FileUploadProps) {
  const generatedId = useId();
  const progressId = useId();
  const controlId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const isBlocked = disabled === true || pending;

  const applySelection = useCallback(
    (chosen: File[]) => {
      const limited = multiple === true ? chosen : chosen.slice(0, 1);
      const rejections = limited
        .map((file) => rejectionOf(file, accept, maxSize))
        .filter((rejection) => rejection !== null);
      const accepted = limited.filter(
        (file) => !rejections.some((rejection) => rejection.file === file),
      );

      setSelected(resetOnSelect === true ? [] : accepted);
      onSelect?.(accepted);

      if (rejections.length > 0) {
        onReject?.(rejections);
      }

      return accepted;
    },
    [accept, maxSize, multiple, onReject, onSelect, resetOnSelect],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      applySelection([...(event.target.files ?? [])]);

      if (resetOnSelect === true) {
        // 値を空へ戻さないと、同じファイルを選び直しても `change` が出ない。
        event.target.value = "";
      }
    },
    [applySelection, onChange, resetOnSelect],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();

      if (!isBlocked) {
        setIsDraggingOver(true);
      }
    },
    [isBlocked],
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLLabelElement>) => {
    const next = event.relatedTarget;

    if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDraggingOver(false);

      if (isBlocked) {
        return;
      }

      const accepted = applySelection([...event.dataTransfer.files]);
      const input = inputRef.current;
      /* istanbul ignore next -- drop を受けるのは input を包む label で、要素が無い状態では起きない。TS の絞り込みのためだけの分岐。 */
      if (input === null) return;

      const transfer = new DataTransfer();

      for (const file of accepted) {
        transfer.items.add(file);
      }

      // 落としたファイルは選択ダイアログを通らないため、書き戻さないと native form の送信に載らない。
      input.files = transfer.files;
    },
    [applySelection, isBlocked],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="file-upload">
      <label
        className={cn(
          "flex flex-col items-center gap-2 rounded-md border-2 border-border border-dashed px-4 py-6 text-center transition-colors",
          isBlocked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-foreground",
          isDraggingOver && "border-foreground bg-accent",
          "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-active has-[input:focus-visible]:outline-offset-2",
          "has-[input[aria-invalid=true]]:border-destructive",
        )}
        data-dragging={isDraggingOver ? "true" : undefined}
        data-slot="file-upload-dropzone"
        htmlFor={controlId}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          accept={accept}
          className="sr-only"
          data-slot="file-upload-input"
          disabled={isBlocked}
          id={controlId}
          multiple={multiple}
          onChange={handleChange}
          ref={inputRef}
          type="file"
          {...props}
        />
        <UploadIcon aria-hidden="true" className="size-6 text-muted-foreground" />
        <span className="text-muted-foreground text-sm">{prompt}</span>
        <span
          className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 font-emphasis text-foreground text-sm"
          data-slot="file-upload-trigger"
        >
          {triggerLabel}
        </span>
      </label>
      {selected.length > 0 ? (
        <ul className="flex flex-col gap-1" data-slot="file-upload-selection">
          {selected.map((file) => (
            <li
              className="truncate text-muted-foreground text-sm"
              key={`${file.name}:${file.size}:${file.lastModified}`}
            >
              {file.name}
            </li>
          ))}
        </ul>
      ) : null}
      {progress === undefined ? null : (
        <div className="flex flex-col gap-1" data-slot="file-upload-progress">
          <span className="text-muted-foreground text-sm" id={progressId}>
            送信中
          </span>
          <ProgressClient aria-labelledby={progressId} value={progress} />
        </div>
      )}
    </div>
  );
}

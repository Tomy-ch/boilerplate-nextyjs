"use client";

import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/app-starter/attachment/attachment";
import { ATTACHMENT_STATE } from "@/components/app-starter/attachment/attachment.definition";
import { cn } from "@/components/cn";
import { Spinner } from "@/components/design-system/status/spinner/spinner";
import { ArrowDownIcon, ArrowUpIcon, RefreshIcon, RotateIcon, XIcon } from "@/components/icon";

import type { UploadPreviewItem, UploadPreviewOrientation } from "./upload-preview.definition";
import { UPLOAD_PREVIEW_ORIENTATION } from "./upload-preview.definition";

type ItemHandler = (id: string) => void;

/** 1 件ぶんの表示。表示用 URL の生涯と、操作の束ねをここで持つ。 */
function UploadPreviewRow({
  item,
  pending,
  onRemove,
  onRetry,
  onReplace,
  onMoveUp,
  onMoveDown,
  atStart,
  atEnd,
}: {
  item: UploadPreviewItem;
  pending: boolean;
  onRemove?: ItemHandler;
  onRetry?: ItemHandler;
  onReplace?: ItemHandler;
  onMoveUp?: ItemHandler;
  onMoveDown?: ItemHandler;
  atStart: boolean;
  atEnd: boolean;
}) {
  const { preview } = item;
  const [objectUrl, setObjectUrl] = useState<string>();

  useEffect(() => {
    if (preview === undefined || typeof preview === "string") return;
    const url = URL.createObjectURL(preview);
    // object URL は解放が要る資源で、破棄と対になるのは commit だけである。描画中に作ると、
    // 捨てられた描画のぶんが破棄されずに残る。
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 資源の生成を伴う同期のため
    setObjectUrl(url);
    // 生成した URL は破棄しないと、選択をやり直すたびに解放されない参照が積み上がる。
    return () => {
      URL.revokeObjectURL(url);
      setObjectUrl(undefined);
    };
  }, [preview]);

  const inFlight =
    item.state === ATTACHMENT_STATE.UPLOADING || item.state === ATTACHMENT_STATE.PROCESSING;
  // 再試行は失敗した件にだけ出す。成功した件へ出すと、押しても何も起きない操作が並ぶ。
  const failed = item.state === ATTACHMENT_STATE.ERROR;
  const previewUrl = typeof preview === "string" ? preview : objectUrl;
  const media =
    previewUrl === undefined ? null : (
      <AttachmentMedia>
        {/* 表示用の URL は object URL にもなり、寸法も配信元も事前に判らないため next/image は使えない。 */}
        {/* biome-ignore lint/performance/noImgElement: 選択直後のファイルは object URL でしか描画できない。 */}
        <img alt="" className="size-full object-cover" src={previewUrl} />
      </AttachmentMedia>
    );

  const remove = useCallback(() => onRemove?.(item.id), [item.id, onRemove]);
  const retry = useCallback(() => onRetry?.(item.id), [item.id, onRetry]);
  const replace = useCallback(() => onReplace?.(item.id), [item.id, onReplace]);
  const moveUp = useCallback(() => onMoveUp?.(item.id), [item.id, onMoveUp]);
  const moveDown = useCallback(() => onMoveDown?.(item.id), [item.id, onMoveDown]);

  return (
    <li>
      <Attachment state={item.state}>
        {media}
        <AttachmentContent>
          <AttachmentTitle>{item.name}</AttachmentTitle>
          {item.description === undefined ? null : (
            <AttachmentDescription>{item.description}</AttachmentDescription>
          )}
        </AttachmentContent>
        <AttachmentActions>
          {inFlight ? <Spinner className="size-4" /> : null}
          {onMoveUp === undefined ? null : (
            <AttachmentAction
              aria-label={`${item.name} を前へ移動する`}
              disabled={pending || atStart}
              onClick={moveUp}
              type="button"
            >
              <ArrowUpIcon aria-hidden="true" />
            </AttachmentAction>
          )}
          {onMoveDown === undefined ? null : (
            <AttachmentAction
              aria-label={`${item.name} を後ろへ移動する`}
              disabled={pending || atEnd}
              onClick={moveDown}
              type="button"
            >
              <ArrowDownIcon aria-hidden="true" />
            </AttachmentAction>
          )}
          {failed && onRetry !== undefined ? (
            <AttachmentAction
              aria-label={`${item.name} を再試行する`}
              disabled={pending}
              onClick={retry}
              type="button"
            >
              <RotateIcon aria-hidden="true" />
            </AttachmentAction>
          ) : null}
          {onReplace === undefined ? null : (
            <AttachmentAction
              aria-label={`${item.name} を差し替える`}
              disabled={pending}
              onClick={replace}
              type="button"
            >
              <RefreshIcon aria-hidden="true" />
            </AttachmentAction>
          )}
          {onRemove === undefined ? null : (
            <AttachmentAction
              aria-label={`${item.name} を取り消す`}
              disabled={pending}
              onClick={remove}
              type="button"
            >
              <XIcon aria-hidden="true" />
            </AttachmentAction>
          )}
        </AttachmentActions>
      </Attachment>
    </li>
  );
}

/**
 * 選択中のファイルを一覧で確認し、差し替え・取り消し・再試行を行う client island。
 *
 * @remarks
 * ファイルを選ぶ受け口は `FileUpload`、1 件の見た目は `Attachment` の責務である。この
 * component が持つのは**選択したものの束ね方と、件ごとの操作の置き方**だけで、送信経路・
 * 保存先・業務上の意味は持たない。操作は callback で呼び出し元へ返す。
 *
 * 一覧の内容は `items` として受け取り、この component は保持しない。取り消しや再試行の結果を
 * 反映するのは呼び出し元である。
 *
 * `preview` に `File` を渡した場合、**表示用 URL の生成と破棄をこの component が引き受ける**。
 * 破棄しないと選択をやり直すたびに解放されない参照が積み上がるため、ここが唯一の持ち主になる。
 * これが client island である理由でもある。
 *
 * 渡さなかった操作の button は描画しない。`pending` の間はすべての操作を止めるが、一覧の表示は
 * 残す。送信中に何を送っているのかが判らなくなるためである。
 *
 * `state` が `uploading` / `processing` の間は、再試行の button を spinner へ差し替える。押した
 * 場所で進行が見え、同じ操作を二度押せなくなる。**spinner が出るのは `state` によってであり、
 * button が押されたことによってではない。** 再送信がいつ終わるかを知っているのは呼び出し元
 * だけなので、押下を起点にすると終われない。呼び出し元は再試行を受けたら `state` を
 * `uploading` にし、結果が出たら `done` か `error` へ移す。
 *
 * `state` は見た目を変えるだけで支援技術へ伝わらない。進行中や失敗は `description` の文言でも
 * 示す。spinner も装飾として置くため、読み上げは `description` が担う。
 *
 * @example
 * ```tsx
 * <UploadPreview
 *   items={[{ id: "1", name: "cover.png", description: "1.2 MB", preview: file }]}
 *   onRemove={remove}
 * />
 * ```
 *
 * @param props.items - 表示する選択中のファイル。並び順はそのまま使う。
 * @param props.pending - 送信中か。すべての操作を止める。
 * @param props.onRemove - 取り消しの操作を受け取る。省略すると button を出さない。
 * @param props.onRetry - 再試行の操作を受け取る。省略すると button を出さない。
 * @param props.onReplace - 差し替えの操作を受け取る。ファイルを選び直す導線は呼び出し元が
 *   `FileUpload` で用意する。省略すると button を出さない。
 * @param props.onMoveUp - 1 つ前へ動かす操作を受け取る。省略すると button を出さない。
 * @param props.onMoveDown - 1 つ後ろへ動かす操作を受け取る。省略すると button を出さない。
 * @param props.orientation - 並べ方。値は {@link UPLOAD_PREVIEW_ORIENTATION}。
 * @param props.label - 一覧のアクセシブルな名前。
 *
 * @see Storybook `Display/UploadPreview`
 */
export function UploadPreview({
  items,
  pending = false,
  onRemove,
  onRetry,
  onReplace,
  onMoveUp,
  onMoveDown,
  orientation = UPLOAD_PREVIEW_ORIENTATION.LIST,
  label = "選択中のファイル",
  className,
  ...props
}: Omit<ComponentProps<"ul">, "children"> & {
  items: readonly UploadPreviewItem[];
  orientation?: UploadPreviewOrientation;
  pending?: boolean;
  onRemove?: ItemHandler;
  onRetry?: ItemHandler;
  onReplace?: ItemHandler;
  onMoveUp?: ItemHandler;
  onMoveDown?: ItemHandler;
  label?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label={label}
      className={cn(
        orientation === UPLOAD_PREVIEW_ORIENTATION.ROW ? "flex flex-wrap gap-3" : "grid gap-2",
        className,
      )}
      data-slot="upload-preview"
      {...props}
    >
      {items.map((item, index) => (
        <UploadPreviewRow
          atEnd={index === items.length - 1}
          atStart={index === 0}
          item={item}
          key={item.id}
          onMoveDown={onMoveDown}
          onMoveUp={onMoveUp}
          onRemove={onRemove}
          onReplace={onReplace}
          onRetry={onRetry}
          pending={pending}
        />
      ))}
    </ul>
  );
}

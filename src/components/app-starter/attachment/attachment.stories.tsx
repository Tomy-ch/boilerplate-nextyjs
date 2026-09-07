import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FileTextIcon, ImageIcon, RotateIcon, XIcon } from "@/components/icon";
import { SAMPLE_DOCUMENT_URL } from "~catalog/lib/sample-asset";
import { Button } from "../../design-system/action/button/button";
import { BUTTON_SIZE, BUTTON_VARIANT } from "../../design-system/action/button/button.definition";
import { MediaImage } from "../../design-system/display/media-image/media-image";
import { MEDIA_IMAGE_ASPECT_RATIO } from "../../design-system/display/media-image/media-image.definition";
import { ProgressClient } from "../../design-system/status/progress-client/progress-client";
import { Spinner } from "../../design-system/status/spinner/spinner";
import { FileUpload } from "../file-upload/file-upload";
import {
  FILE_UPLOAD_REJECTION_REASON,
  type FileUploadRejection,
} from "../file-upload/file-upload.definition";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "./attachment";
import {
  ATTACHMENT_MEDIA_VARIANT,
  ATTACHMENT_ORIENTATION,
  ATTACHMENT_SIZE,
  ATTACHMENT_STATE,
  type AttachmentOrientation,
  type AttachmentSize,
  type AttachmentState,
} from "./attachment.definition";

function FileAttachment({
  description = "1.2 MB",
  orientation,
  size,
  state,
  title = "仕様書.pdf",
}: {
  description?: string;
  orientation?: AttachmentOrientation;
  size?: AttachmentSize;
  state?: AttachmentState;
  title?: string;
}) {
  return (
    <Attachment orientation={orientation} size={size} state={state}>
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{title}</AttachmentTitle>
        <AttachmentDescription>{description}</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  );
}

function DefaultAttachment() {
  return <FileAttachment />;
}

function AllStates() {
  return (
    <div className="flex flex-col gap-3">
      <FileAttachment description="ファイルを選んでください" state={ATTACHMENT_STATE.IDLE} />
      <Attachment state={ATTACHMENT_STATE.UPLOADING}>
        <AttachmentMedia>
          <Spinner />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>仕様書.pdf</AttachmentTitle>
          <AttachmentDescription>送信中 40%</AttachmentDescription>
        </AttachmentContent>
      </Attachment>
      <FileAttachment description="変換中" state={ATTACHMENT_STATE.PROCESSING} />
      <Attachment state={ATTACHMENT_STATE.ERROR}>
        <AttachmentMedia>
          <FileTextIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>仕様書.pdf</AttachmentTitle>
          <AttachmentDescription>送信できませんでした</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="仕様書.pdf を再送する">
            <RotateIcon aria-hidden="true" />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
      <FileAttachment state={ATTACHMENT_STATE.DONE} />
    </div>
  );
}

function AllSizes() {
  return (
    <div className="flex flex-col gap-3">
      <FileAttachment description="default" size={ATTACHMENT_SIZE.DEFAULT} />
      <FileAttachment description="sm" size={ATTACHMENT_SIZE.SMALL} />
      <FileAttachment description="xs" size={ATTACHMENT_SIZE.EXTRA_SMALL} />
    </div>
  );
}

function VerticalAttachment() {
  return (
    <div className="flex gap-3">
      <Attachment orientation={ATTACHMENT_ORIENTATION.VERTICAL}>
        <AttachmentMedia variant={ATTACHMENT_MEDIA_VARIANT.IMAGE}>
          <MediaImage
            alt=""
            aspectRatio={MEDIA_IMAGE_ASPECT_RATIO.SQUARE}
            className="size-full"
            sizes="6rem"
            src={SAMPLE_DOCUMENT_URL}
          />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>外観.png</AttachmentTitle>
          <AttachmentDescription>320 KB</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="外観.png を取り消す">
            <XIcon aria-hidden="true" />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
      <Attachment orientation={ATTACHMENT_ORIENTATION.VERTICAL}>
        <AttachmentMedia>
          <ImageIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>図版.svg</AttachmentTitle>
          <AttachmentDescription>12 KB</AttachmentDescription>
        </AttachmentContent>
      </Attachment>
    </div>
  );
}

function ImageMediaAttachment() {
  return (
    <Attachment>
      <AttachmentMedia variant={ATTACHMENT_MEDIA_VARIANT.IMAGE}>
        <MediaImage
          alt=""
          aspectRatio={MEDIA_IMAGE_ASPECT_RATIO.SQUARE}
          className="size-full"
          sizes="2.5rem"
          src={SAMPLE_DOCUMENT_URL}
        />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>外観.png</AttachmentTitle>
        <AttachmentDescription>320 KB</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  );
}

function PressableAttachment() {
  return (
    <Attachment>
      <AttachmentTrigger aria-label="仕様書.pdf を開く" />
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>仕様書.pdf</AttachmentTitle>
        <AttachmentDescription>1.2 MB</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label="仕様書.pdf を取り消す">
          <XIcon aria-hidden="true" />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  );
}

function TruncatedAttachment() {
  return (
    <FileAttachment
      description="この補足も枠に収まらないため末尾が省略されます"
      title="とても長いファイル名の付いた添付ファイルの例.pdf"
    />
  );
}

function GroupedAttachments() {
  return (
    <div className="w-[26rem] max-w-[calc(100vw-2rem)]">
      <AttachmentGroup>
        {["仕様書.pdf", "外観.png", "図版.svg", "議事録.docx", "見積.xlsx"].map((name) => (
          <FileAttachment description="1.2 MB" key={name} title={name} />
        ))}
      </AttachmentGroup>
    </div>
  );
}

const UPLOAD_DELAY_MS = 1200;
const DISMISS_DELAY_MS = 9000;
const DISMISS_TICK_MS = 100;
const MAX_SIZE = 2 * 1024 * 1024;

type UploadEntry = {
  id: number;
  name: string;
  description: string;
  state: AttachmentState;
  /** 自動で消えるまでの残り時間（ms）。自動削除の対象でない間は持たない。 */
  remaining?: number;
};

function formatSize(size: number): string {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function rejectionText(rejection: FileUploadRejection): string {
  return rejection.reason === FILE_UPLOAD_REJECTION_REASON.SIZE
    ? `${formatSize(MAX_SIZE)} を超えています`
    : "この形式は選べません";
}

/**
 * 残り時間を減らし、0 になった添付を一覧から外す。hover / focus 中と画面が見えていない間は
 * 進めない（WCAG 2.2.1）。
 */
function useDismissCountdown(
  setEntries: Dispatch<SetStateAction<UploadEntry[]>>,
  pausedRef: RefObject<boolean>,
) {
  useEffect(() => {
    let measuredAt = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - measuredAt;
      measuredAt = now;

      if (document.hidden || pausedRef.current) {
        return;
      }

      setEntries((current) =>
        current.some((entry) => entry.remaining !== undefined)
          ? current
              .map((entry) =>
                entry.remaining === undefined
                  ? entry
                  : { ...entry, remaining: entry.remaining - elapsed },
              )
              .filter((entry) => entry.remaining === undefined || entry.remaining > 0)
          : current,
      );
    }, DISMISS_TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [pausedRef, setEntries]);
}

const DISMISSING_ENTRIES: UploadEntry[] = [
  {
    id: 0,
    name: "仕様書.pdf",
    description: "1.2 MB",
    remaining: 6000,
    state: ATTACHMENT_STATE.DONE,
  },
  { id: 1, name: "外観.png", description: "320 KB", remaining: 9000, state: ATTACHMENT_STATE.DONE },
  {
    id: 2,
    name: "大きすぎる画像.png",
    description: "2.0 MB を超えています",
    state: ATTACHMENT_STATE.ERROR,
  },
];

function DismissingFixture() {
  const [entries, setEntries] = useState<UploadEntry[]>(DISMISSING_ENTRIES);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useDismissCountdown(setEntries, pausedRef);

  const reset = useCallback(() => {
    setEntries(DISMISSING_ENTRIES);
  }, []);

  const pauseDismiss = useCallback(() => {
    setPaused(true);
  }, []);

  const resumeDismiss = useCallback(() => {
    setPaused(false);
  }, []);

  return (
    <div className="flex w-[26rem] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 自動削除の計時を止めるための hover / focus であり、この領域自体は操作ではない */}
      <div
        className="flex flex-col gap-2"
        onBlur={resumeDismiss}
        onFocus={pauseDismiss}
        onMouseEnter={pauseDismiss}
        onMouseLeave={resumeDismiss}
      >
        {entries.map((entry) => (
          <Attachment key={entry.id} state={entry.state}>
            <AttachmentMedia>
              <FileTextIcon />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{entry.name}</AttachmentTitle>
              <AttachmentDescription>{entry.description}</AttachmentDescription>
              {entry.remaining === undefined ? null : (
                <ProgressClient
                  aria-label={`${entry.name} はあと${Math.ceil(entry.remaining / 1000)}秒で一覧から消えます`}
                  className="mt-1 h-1"
                  indicatorClassName="duration-100 ease-linear"
                  max={DISMISS_DELAY_MS}
                  value={entry.remaining}
                />
              )}
            </AttachmentContent>
          </Attachment>
        ))}
      </div>
      <Button onClick={reset} size={BUTTON_SIZE.SMALL} variant={BUTTON_VARIANT.OUTLINE}>
        並べ直す
      </Button>
    </div>
  );
}

function UploadFlowFixture({ autoDismiss = false }: { autoDismiss?: boolean }) {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const nextIdRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoDismissRef = useRef(autoDismiss);
  const pausedRef = useRef(paused);

  useEffect(() => {
    autoDismissRef.current = autoDismiss;
  }, [autoDismiss]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current) {
        clearTimeout(timer);
      }
    },
    [],
  );

  useDismissCountdown(setEntries, pausedRef);

  const remove = useCallback((id: number) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const handleSelect = useCallback((files: File[]) => {
    const added = files.map((file) => ({
      file,
      entry: {
        id: nextIdRef.current++,
        name: file.name,
        description: "送信中",
        state: ATTACHMENT_STATE.UPLOADING,
      },
    }));
    setEntries((current) => [...current, ...added.map(({ entry }) => entry)]);

    for (const { file, entry } of added) {
      timersRef.current.push(
        setTimeout(() => {
          // 消すかどうかは一覧を持つ側の判断。error は対処が要るので対象にしない。
          setEntries((current) =>
            current.map((item) =>
              item.id === entry.id
                ? {
                    ...item,
                    description: formatSize(file.size),
                    remaining: autoDismissRef.current ? DISMISS_DELAY_MS : undefined,
                    state: ATTACHMENT_STATE.DONE,
                  }
                : item,
            ),
          );
        }, UPLOAD_DELAY_MS),
      );
    }
  }, []);

  const handleReject = useCallback((rejections: FileUploadRejection[]) => {
    setEntries((current) => [
      ...current,
      ...rejections.map((rejection) => ({
        id: nextIdRef.current++,
        name: rejection.file.name,
        description: rejectionText(rejection),
        state: ATTACHMENT_STATE.ERROR,
      })),
    ]);
  }, []);

  const pauseDismiss = useCallback(() => {
    setPaused(true);
  }, []);

  const resumeDismiss = useCallback(() => {
    setPaused(false);
  }, []);

  const pending = entries.some((entry) => entry.state === ATTACHMENT_STATE.UPLOADING);

  return (
    <div className="flex w-[30rem] max-w-[calc(100vw-2rem)] flex-col gap-4">
      <FileUpload
        accept="image/png,image/jpeg,application/pdf"
        maxSize={MAX_SIZE}
        multiple
        onReject={handleReject}
        onSelect={handleSelect}
        pending={pending}
      />
      {entries.length === 0 ? null : (
        // biome-ignore lint/a11y/noStaticElementInteractions: 自動削除の計時を止めるための hover / focus であり、この領域自体は操作ではない
        <div
          className="flex flex-col gap-2"
          onBlur={resumeDismiss}
          onFocus={pauseDismiss}
          onMouseEnter={pauseDismiss}
          onMouseLeave={resumeDismiss}
        >
          {entries.map((entry) => (
            <Attachment key={entry.id} state={entry.state}>
              <AttachmentMedia>
                <FileTextIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{entry.name}</AttachmentTitle>
                <AttachmentDescription>{entry.description}</AttachmentDescription>
                {entry.remaining === undefined ? null : (
                  <ProgressClient
                    aria-label={`${entry.name} はあと${Math.ceil(entry.remaining / 1000)}秒で一覧から消えます`}
                    className="mt-1 h-1"
                    indicatorClassName="duration-100 ease-linear"
                    max={DISMISS_DELAY_MS}
                    value={entry.remaining}
                  />
                )}
              </AttachmentContent>
              <AttachmentActions>
                <RemoveAction id={entry.id} name={entry.name} onRemove={remove} />
              </AttachmentActions>
            </Attachment>
          ))}
        </div>
      )}
    </div>
  );
}

function RemoveAction({
  id,
  name,
  onRemove,
}: {
  id: number;
  name: string;
  onRemove: (id: number) => void;
}) {
  const handleClick = useCallback(() => {
    onRemove(id);
  }, [id, onRemove]);

  return (
    <AttachmentAction aria-label={`${name} を取り消す`} onClick={handleClick}>
      <XIcon aria-hidden="true" />
    </AttachmentAction>
  );
}

const meta = {
  title: "Display/Attachment",
  component: Attachment,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Attachment>;

export default meta;
type Story = StoryObj<typeof meta>;

/** アイコン・名前・補足を横に並べた既定の添付。 */
export const Default: Story = { render: () => <DefaultAttachment /> };

/** 段階 5 種。見た目だけが変わるため、意味は補足のテキストが伝える。 */
export const States: Story = { render: () => <AllStates /> };

/**
 * 送信が終わった添付が自動で消えるまでの見え方。残り時間を示し、hover / focus 中と画面が
 * 見えていない間は計時を止める。対処が必要な `error` は消えない。
 *
 * 自動削除は一覧を持つ側の設定であり、この component の機能ではない。実際の配線は
 * `UploadFlowAutoDismiss` を見る。
 */
export const Dismissing: Story = { render: () => <DismissingFixture /> };

/** 大きさ 3 種。 */
export const Sizes: Story = { render: () => <AllSizes /> };

/** 縦に並べる場合。操作は枠の右上へ重なる。 */
export const Vertical: Story = { render: () => <VerticalAttachment /> };

/** 画像を縮小表示として置く場合。 */
export const ImageMedia: Story = { render: () => <ImageMediaAttachment /> };

/** 枠全体を押せるようにした場合。個別の操作は trigger の上に重なる。 */
export const Pressable: Story = { render: () => <PressableAttachment /> };

/** 枠に収まらない名前と補足の省略。 */
export const Truncated: Story = { render: () => <TruncatedAttachment /> };

/** 複数を横に並べ、収まらない分を横スクロールする場合。 */
export const Grouped: Story = { render: () => <GroupedAttachments /> };

/**
 * `FileUpload` で実際に選び、受理分を添付として並べる配線例。**選んだものは消えない。**
 * 取り消しは利用者が `×` で行う。
 */
export const UploadFlow: Story = { render: () => <UploadFlowFixture /> };

/**
 * 送信が終わった添付を自動で消す場合。消えるまでの残り時間を示し、hover / focus 中と
 * 画面が見えていない間は計時を止める。
 *
 * これは一覧を持つ側の設定であり、`Attachment` の機能ではない。対処が必要な `error` は
 * 自動で消さない。
 */
export const UploadFlowAutoDismiss: Story = {
  render: () => <UploadFlowFixture autoDismiss />,
};

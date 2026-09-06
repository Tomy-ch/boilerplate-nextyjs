/**
 * アプリが使うアイコンの公開面です。
 *
 * @remarks
 * アイコンの供給元を名指しできる唯一の場所です（[0052](../../docs/adr/0052-ui-component-policy.md)）。
 *
 * **名前付き再輸出以外の形にしないでください。** 名前から component を引く表
 * （`{ "chevron-right": ... }`）を置くと、その表がセット全体への静的な参照になり、使っていない
 * ものまでバンドルへ乗ります。再輸出なら、呼び出し側が import したものだけが残ります。
 *
 * **公開名は供給元の綴りではなく、この面の語彙です。**供給元が別の名前で同じ字面を配っていても、
 * ここでの名前は変えません。差し替えたときに呼び出し側が動かないことが、閉じ込めの目的そのもの
 * だからです。
 */
import type { ComponentProps, ComponentType } from "react";

/**
 * アイコン component の型です。
 *
 * @remarks
 * 一覧や対応表の値としてアイコンを持つ場合に使います。
 *
 * この面が約束するのは `svg` を描くことだけです。供給元の型を別名にすると、供給元が足した
 * props がここを通って漏れます（公開名についての段と同じ理由）。
 */
export type IconComponent = ComponentType<ComponentProps<"svg">>;

export {
  IconAlertTriangle as AlertTriangleIcon,
  IconArrowDown as ArrowDownIcon,
  IconArrowUp as ArrowUpIcon,
  IconBell as BellIcon,
  IconBold as BoldIcon,
  IconCalendar as CalendarIcon,
  IconCheck as CheckIcon,
  IconChevronDown as ChevronDownIcon,
  IconChevronLeft as ChevronLeftIcon,
  IconChevronRight as ChevronRightIcon,
  IconChevronUp as ChevronUpIcon,
  IconSelector as ChevronsUpDownIcon,
  IconAlertCircle as CircleAlertIcon,
  IconCircleCheck as CircleCheckIcon,
  IconCircle as CircleIcon,
  IconCircleX as CircleXIcon,
  IconClock as ClockIcon,
  IconCode as CodeIcon,
  IconCoin as CoinIcon,
  IconCopy as CopyIcon,
  IconDownload as DownloadIcon,
  IconDots as EllipsisIcon,
  IconExternalLink as ExternalLinkIcon,
  IconEye as EyeIcon,
  IconFileText as FileTextIcon,
  IconFilter as FilterIcon,
  IconGripVertical as GripVerticalIcon,
  IconH2 as Heading2Icon,
  IconH3 as Heading3Icon,
  IconH4 as Heading4Icon,
  IconPhoto as ImageIcon,
  IconInbox as InboxIcon,
  IconInfoCircle as InfoIcon,
  IconItalic as ItalicIcon,
  IconKey as KeyIcon,
  IconLink as LinkIcon,
  IconList as ListIcon,
  IconListNumbers as ListOrderedIcon,
  IconLoader2 as LoaderIcon,
  IconLock as LockIcon,
  IconMap as MapIcon,
  IconMenu2 as MenuIcon,
  IconMessageCircle as MessageCircleIcon, // sample:line
  IconMinus as MinusIcon,
  IconPencil as PencilIcon,
  IconPlus as PlusIcon,
  IconPrinter as PrinterIcon,
  IconQuote as QuoteIcon,
  IconArrowForwardUp as RedoIcon,
  IconRefresh as RefreshIcon,
  IconRotate as RotateIcon,
  IconSearch as SearchIcon,
  IconSearchOff as SearchOffIcon,
  IconSettings as SettingsIcon,
  IconShield as ShieldIcon,
  IconShoppingCart as ShoppingCartIcon, // sample:line
  IconLayoutSidebar as SidebarIcon,
  IconAdjustments as SlidersIcon,
  IconStrikethrough as StrikethroughIcon,
  IconTable as TableIcon,
  IconTextWrap as TextWrapIcon,
  IconTrash as TrashIcon,
  IconArrowBackUp as UndoIcon,
  IconUnlink as UnlinkIcon,
  IconUpload as UploadIcon,
  IconUser as UserIcon,
  IconX as XIcon,
} from "@tabler/icons-react";

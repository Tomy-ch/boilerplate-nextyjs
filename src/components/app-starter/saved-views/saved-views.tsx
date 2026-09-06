"use client";

import type { ChangeEvent, SyntheticEvent } from "react";
import { useCallback, useId, useState } from "react";
import { Button } from "@/components/design-system/action/button/button";
import {
  BUTTON_SIZE,
  BUTTON_VARIANT,
} from "@/components/design-system/action/button/button.definition";
import { Field, FieldLabel } from "@/components/design-system/form/field/field";
import { Input } from "@/components/design-system/form/input/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/design-system/overlay/alert-dialog/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/design-system/overlay/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/design-system/overlay/dropdown-menu/dropdown-menu";
import { DROPDOWN_MENU_ITEM_VARIANT } from "@/components/design-system/overlay/dropdown-menu/dropdown-menu.definition";
import { ChevronsUpDownIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icon";
import { SAVED_VIEWS_DIALOG, type SavedViewsDialog } from "./saved-views.definition";

/** 保存済みの一覧条件 1 件。 */
export type SavedView = {
  /** 条件の識別子。呼び出し元が発行する。 */
  id: string;
  /** 利用者が付けた名前。menu と dialog にそのまま出る。 */
  name: string;
};

/** {@link SavedViews} の props。 */
export type SavedViewsProps = {
  /** 選べる条件。空のときは menu が「保存した条件はありません」を出す。 */
  views: readonly SavedView[];
  /**
   * いま適用している条件の `id`。
   *
   * `null` は「保存した条件をどれも当てていない」を表し、名前の変更と削除は選べなくなる。
   */
  currentViewId?: string | null;
  /** 条件を選んだ。 */
  onSelect: (viewId: string) => void;
  /** いまの条件へ名前を付けて保存する。条件そのものは呼び出し元が持つ。 */
  onCreate: (name: string) => void;
  /** 選択中の条件の名前を変えた。 */
  onRename: (viewId: string, name: string) => void;
  /** 選択中の条件を消した。確認は済んでいる。 */
  onDelete: (viewId: string) => void;
  /** 操作のアクセシブルな名前。条件を当てていないときは trigger の表示にもなる。 */
  label?: string;
};

/**
 * 保存した一覧条件を選び直し、名前を変え、消す client island。
 *
 * @remarks
 * menu と dialog の開閉を browser 側で行うため hydration が必要で、Server Component からは
 * 直接 render できない。
 *
 * 条件の中身を持たない。この component が扱うのは `id` と名前だけで、絞り込み・並べ替えの値、
 * 保存先、URL との同期は呼び出し元が所有する。`onCreate` へ渡すのも名前だけであり、いまの条件を
 * どう束ねて保存するかはこの component の外で決まる。
 *
 * 名前の変更と削除は**選択中の 1 件**が対象になる。`currentViewId` が `null` の間は両方とも
 * 選べない。削除は取り消せないため `AlertDialog` の確認を挟む。
 *
 * 名前は前後の空白を落として渡す。空白だけの名前は保存できない。
 *
 * @example
 * ```tsx
 * "use client";
 *
 * import { useState } from "react";
 *
 * import { SavedViews } from "@/components/app-starter/saved-views/saved-views";
 *
 * export function ListToolbar() {
 *   const [views, setViews] = useState([{ id: "recent", name: "最近の更新" }]);
 *   const [currentViewId, setCurrentViewId] = useState<string | null>("recent");
 *
 *   return (
 *     <SavedViews
 *       currentViewId={currentViewId}
 *       onCreate={(name) => setViews((current) => [...current, { id: name, name }])}
 *       onDelete={(id) => setViews((current) => current.filter((view) => view.id !== id))}
 *       onRename={(id, name) =>
 *         setViews((current) => current.map((view) => (view.id === id ? { ...view, name } : view)))
 *       }
 *       onSelect={setCurrentViewId}
 *       views={views}
 *     />
 *   );
 * }
 * ```
 *
 * @param props - 選べる条件と、選択・保存・改名・削除の受け取り方。
 * @param props.views - 選べる条件。
 * @param props.currentViewId - いま適用している条件の `id`。
 *
 * @see Storybook `Container/SavedViews`
 */
export function SavedViews({
  views,
  currentViewId = null,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  label = "保存した条件",
}: SavedViewsProps) {
  const nameInputId = useId();
  const [dialog, setDialog] = useState<SavedViewsDialog | null>(null);
  const [draftName, setDraftName] = useState("");

  const currentView = views.find((view) => view.id === currentViewId) ?? null;
  const hasCurrentView = currentView !== null;
  const currentViewName = currentView?.name ?? "";

  const openCreate = useCallback(() => {
    setDraftName("");
    setDialog(SAVED_VIEWS_DIALOG.CREATE);
  }, []);

  const openRename = useCallback(() => {
    setDraftName(currentViewName);
    setDialog(SAVED_VIEWS_DIALOG.RENAME);
  }, [currentViewName]);

  const openDelete = useCallback(() => setDialog(SAVED_VIEWS_DIALOG.DELETE), []);

  // 開くのは menu の項目だけなので、開閉の要求は必ず「閉じる」を意味する。
  const closeDialog = useCallback(() => setDialog(null), []);

  const changeDraftName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDraftName(event.target.value),
    [],
  );

  const submitName = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();

      const name = draftName.trim();

      if (name === "") {
        return;
      }

      if (dialog === SAVED_VIEWS_DIALOG.CREATE) {
        onCreate(name);
      } else if (currentView !== null) {
        onRename(currentView.id, name);
      }

      setDialog(null);
    },
    [currentView, dialog, draftName, onCreate, onRename],
  );

  const confirmDelete = useCallback(() => {
    if (currentView !== null) {
      onDelete(currentView.id);
    }

    setDialog(null);
  }, [currentView, onDelete]);

  const isNameDialogOpen =
    dialog === SAVED_VIEWS_DIALOG.CREATE || dialog === SAVED_VIEWS_DIALOG.RENAME;
  const triggerName = hasCurrentView ? currentViewName : label;
  const nameDialogTitle = dialog === SAVED_VIEWS_DIALOG.RENAME ? "条件の名前を変更" : "条件を保存";
  const nameDialogDescription =
    dialog === SAVED_VIEWS_DIALOG.RENAME
      ? "一覧に出す名前を書き換えます。条件そのものは変わりません。"
      : "いま適用している条件に名前を付けて残します。";

  return (
    <div data-slot="saved-views">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-slot="saved-views-trigger"
            size={BUTTON_SIZE.SMALL}
            type="button"
            variant={BUTTON_VARIANT.OUTLINE}
          >
            {triggerName}
            <ChevronsUpDownIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {views.length === 0 ? (
            <DropdownMenuItem disabled>保存した条件はありません</DropdownMenuItem>
          ) : (
            <DropdownMenuRadioGroup onValueChange={onSelect} value={currentViewId ?? ""}>
              {views.map((view) => (
                <DropdownMenuRadioItem key={view.id} value={view.id}>
                  {view.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openCreate}>
            <PlusIcon aria-hidden="true" />
            現在の条件を保存
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasCurrentView} onSelect={openRename}>
            <PencilIcon aria-hidden="true" />
            名前を変更
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasCurrentView}
            onSelect={openDelete}
            variant={DROPDOWN_MENU_ITEM_VARIANT.DESTRUCTIVE}
          >
            <TrashIcon aria-hidden="true" />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={closeDialog} open={isNameDialogOpen}>
        <DialogContent>
          <form onSubmit={submitName}>
            <DialogHeader>
              <DialogTitle>{nameDialogTitle}</DialogTitle>
              <DialogDescription>{nameDialogDescription}</DialogDescription>
            </DialogHeader>
            <Field className="py-4">
              <FieldLabel htmlFor={nameInputId}>名前</FieldLabel>
              <Input id={nameInputId} onChange={changeDraftName} required value={draftName} />
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant={BUTTON_VARIANT.OUTLINE}>
                  キャンセル
                </Button>
              </DialogClose>
              <Button disabled={draftName.trim() === ""} type="submit">
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={closeDialog} open={dialog === SAVED_VIEWS_DIALOG.DELETE}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>条件を削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{currentViewName}」を削除します。取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

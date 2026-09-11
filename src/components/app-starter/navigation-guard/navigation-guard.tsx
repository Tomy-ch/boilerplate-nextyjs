"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../design-system/overlay/alert-dialog/alert-dialog";

/** {@link NavigationGuard} の props。 */
export type NavigationGuardProps = {
  /** 遷移を確認するか。未保存の変更があるあいだ `true` にする。 */
  when: boolean;
  /** 監視する範囲。この配下の link click を傍受する。 */
  children: ReactNode;
  /** 確認 dialog の見出し。 */
  title?: string;
  /** 何が失われるかを伝える説明。 */
  description?: string;
  /** 遷移を続ける操作の文言。 */
  confirmLabel?: string;
  /** 留まる操作の文言。 */
  cancelLabel?: string;
};

/** click の経路から、遷移の起点になる link を探す。 */
function findAnchor(path: readonly EventTarget[]): HTMLAnchorElement | undefined {
  for (const node of path) {
    if (node instanceof HTMLAnchorElement) return node;
  }

  return undefined;
}

/** 同一 origin かつ現在地と異なる遷移先だけを、確認の対象にする。 */
function resolveGuardedHref(anchor: HTMLAnchorElement): string | undefined {
  if (anchor.target !== "" && anchor.target !== "_self") return undefined;
  if (anchor.origin !== window.location.origin) return undefined;
  if (anchor.hasAttribute("download")) return undefined;

  const href = `${anchor.pathname}${anchor.search}${anchor.hash}`;
  const current = `${window.location.pathname}${window.location.search}`;

  return href === current ? undefined : href;
}

/**
 * 未保存のままアプリ内を移動しようとしたときに、確認してから遷移する client island。
 *
 * @remarks
 * 配下の link の click を捕捉段階で受け取り、`when` が `true` のあいだは遷移を止めて
 * `AlertDialog` を出す。続行を選んだときだけ router で遷移する。
 *
 * 抑止できるのは **配下の link による遷移** だけである。次のものは対象外にしている。
 *
 * - 別 origin への link、`target` 指定、`download` — 画面を離れる意図が明示されている
 * - 現在地と同じ URL — 遷移が起きない
 * - 修飾キーつきの click や中クリック — 別タブで開く操作であり、この画面は離れない
 *
 * **browser の戻る / 進むは抑止しない。** App Router は client 側の遷移を止める API を持たず、
 * `popstate` は遷移後にしか発火しないため、履歴を差し戻す以外の手段がない。それは利用者の操作を
 * 覆すことになるので採らない。リロードとタブを閉じる操作は `UnloadGuard` が扱う。
 *
 * 未保存かどうかの判定、保存処理、遷移先の決定は持たない。呼び出し元が `when` と link を渡す。
 *
 * dialog を閉じたときの focus は、押した link へ自分で戻す。Radix は `AlertDialogTrigger` へ
 * 戻す実装で、trigger を持たないこの部品では focus が document へ落ちてしまう。そのため dialog は
 * 閉じているあいだも mount したままにする。閉じると同時に unmount すると復帰の機会が失われる。
 *
 * @example
 * ```tsx
 * <NavigationGuard when={isDirty}>
 *   <nav>
 *     <Link href="/settings">設定</Link>
 *   </nav>
 * </NavigationGuard>
 * ```
 *
 * @see Storybook `Navigation/NavigationGuard`
 */
export function NavigationGuard({
  when,
  children,
  title = "編集中の内容が保存されていません",
  description = "このまま移動すると、入力した内容は失われます。",
  confirmLabel = "移動する",
  cancelLabel = "留まる",
}: NavigationGuardProps) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState("");
  const [open, setOpen] = useState(false);
  const pendingAnchorRef = useRef<HTMLAnchorElement>(null);

  const interceptNavigation = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!when) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = findAnchor(event.nativeEvent.composedPath());
      if (anchor === undefined) return;

      const href = resolveGuardedHref(anchor);
      if (href === undefined) return;

      event.preventDefault();
      pendingAnchorRef.current = anchor;
      setPendingHref(href);
      setOpen(true);
    },
    [when],
  );

  const restoreFocus = useCallback((event: Event) => {
    event.preventDefault();
    pendingAnchorRef.current?.focus();
  }, []);

  const leave = useCallback(() => {
    setOpen(false);
    router.push(pendingHref);
  }, [pendingHref, router]);

  return (
    // 箱はレイアウトに参加させない。click を捕まえるために要素そのものは要るが、包んだ時点で
    // 中身の配置が変わると、見張るために置いただけの器が見た目を動かすことになる。
    <div className="contents" data-slot="navigation-guard" onClickCapture={interceptNavigation}>
      {children}
      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent onCloseAutoFocus={restoreFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>{confirmLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

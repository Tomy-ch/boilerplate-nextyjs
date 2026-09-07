"use client";

import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";

import type { Surface } from "@/components/design-system/foundation/surface/surface.definition";

/** 脇の一覧の開閉。 */
type AdminShellNavState = {
  /** 脇の一覧を出しているか。 */
  readonly open: boolean;
  /** 出す・畳むを切り替える。 */
  readonly toggle: () => void;
};

const AdminShellNavContext = createContext<AdminShellNavState | null>(null);

/**
 * 開閉の状態を読む。
 *
 * @throws 供給の外で呼んだとき
 */
export function useAdminShellNav(): AdminShellNavState {
  const state = use(AdminShellNavContext);

  if (state === null) {
    throw new Error("AdminShellNavStateProvider の外で脇の一覧の開閉を読もうとしました");
  }

  return state;
}

/** `AdminShellNavStateProvider` の props。 */
export type AdminShellNavStateProviderProps = {
  /** 器の中身。開閉を読む側と、切り替える側の両方を含む。 */
  children: ReactNode;
  /** 器の外枠に付ける class 名。 */
  className?: string;
  /**
   * 器が名乗る系統。
   *
   * @remarks
   * 外枠の要素はこの供給が描くため、そこに載る属性はこの供給の API です。既定の系統なら渡しません
   * （`tokens/README.md`「切替の軸は 2 本」）。
   */
  "data-surface"?: Surface;
};

/**
 * 脇の一覧の開閉を、器の全体へ配る。
 *
 * @remarks
 * **開閉だけがブラウザ側の関心で、器の骨格は server のままです。** 切り替える操作は header に、
 * 開閉に応じて姿を変えるのは脇の一覧にあり、両者は兄弟の位置にあります。共通の親でしか状態を
 * 分け合えないため、器そのものを client にする代わりにこの供給だけを client へ置きます。
 *
 * 状態を **`data-nav-open` として外枠に出します。** 脇の一覧はこの属性を CSS の条件として読むため、
 * 状態を props で受け取る必要がなく、Server Component のまま居られます。
 *
 * 畳んだ状態は覚えません。覚える先は cookie になり、器のためだけに要求ごとの読み取りを増やす
 * ことになります。route の遷移では器が作り直されないため、畳んだ状態は画面を移っても続きます。
 */
export function AdminShellNavStateProvider({
  children,
  className,
  "data-surface": surface,
}: AdminShellNavStateProviderProps) {
  const [open, setOpen] = useState(true);
  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);
  const state = useMemo(() => ({ open, toggle }), [open, toggle]);

  return (
    <AdminShellNavContext value={state}>
      <div className={className} data-nav-open={open} data-surface={surface}>
        {children}
      </div>
    </AdminShellNavContext>
  );
}

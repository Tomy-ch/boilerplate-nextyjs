"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/cn";
import { ChevronRightIcon } from "@/components/icon";

import type { AdminShellNavGroup } from "./admin-shell.definition";

/** `AdminShellNav` の props。 */
export type AdminShellNavProps = {
  /** 並べる導線のまとまり。 */
  groups: readonly AdminShellNavGroup[];
  /** この navigation が何の導線かを示す名前。同じ器に複数並ぶため省略できない。 */
  label: string;
  /** 外側の余白や高さを決める class 名。 */
  className?: string;
};

/**
 * 脇と overlay の双方に出る、admin の導線一覧。
 *
 * @remarks
 * **現在地の印だけがブラウザ側の関心です。** どの項目を指しているかは今いる URL で決まり、
 * server では route segment の外から取れません。導線の中身そのものは渡された値で決まるため、
 * ここが持つ状態はありません。
 *
 * 印は行き先が今いる場所と**完全に一致するとき**だけ付けます。前方一致にすると、`/admin/reports`
 * の下に `/admin/reports/new` を足した時点で一覧と作成の両方に印が付きます。
 *
 * **まとまりは畳めます。** 見出しは遷移ではなく開閉の操作で、`details` / `summary` が持つ native の
 * 開閉に乗ります。開閉のためだけに client の状態を持つと、最初の描画で全部開いた姿が一度出ます。
 * 見出しに遷移は持たせません（理由は `AdminShellNavGroup` の型 doc）。
 *
 * @see Storybook `Layout/AdminShell`
 */
export function AdminShellNav({ groups, label, className }: AdminShellNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className={cn("flex flex-col gap-3", className)}>
      {groups.map((group) => (
        <details className="group/nav-group" key={group.label} open>
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1.5 text-xs font-emphasis text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon
              aria-hidden="true"
              className="size-3.5 shrink-0 transition-transform group-open/nav-group:rotate-90"
            />
            {group.label}
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {group.items.map((item) => {
              const current = pathname === item.href;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                      current && "bg-accent font-emphasis text-accent-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </nav>
  );
}

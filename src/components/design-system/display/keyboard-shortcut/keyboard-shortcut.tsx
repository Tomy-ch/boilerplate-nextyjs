import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import type { ShortcutPlatform } from "./keyboard-shortcut.definition";
import { KeyboardShortcutKeys } from "./keyboard-shortcut-keys";

/**
 * キー操作の案内を並べる一覧。
 *
 * @remarks
 * 操作の説明とキーの対を `dl` として並べる、表示専用の Server Component である。並び順・件数・
 * どの操作を載せるかは呼び出し元が決める。
 *
 * @example
 * ```tsx
 * <KeyboardShortcutList>
 *   <KeyboardShortcut keys={[SHORTCUT_MODIFIER.MOD, "K"]}>コマンドパレットを開く</KeyboardShortcut>
 * </KeyboardShortcutList>
 * ```
 *
 * @see Storybook `Display/KeyboardShortcut`
 */
export function KeyboardShortcutList({ className, ...props }: ComponentProps<"dl">) {
  return (
    <dl
      className={cn("flex flex-col gap-2", className)}
      data-slot="keyboard-shortcut-list"
      {...props}
    />
  );
}

/** {@link KeyboardShortcut} の props。 */
export type KeyboardShortcutProps = ComponentProps<"div"> & {
  /** 押す順に並べたキー。修飾キーは {@link SHORTCUT_MODIFIER} の値で渡す。 */
  keys: readonly string[];
  /** 表記を固定するプラットフォーム。省略すると閲覧環境から決める。 */
  platform?: ShortcutPlatform;
};

/**
 * ひと組の「何が起きるか」と「どのキーか」の対。
 *
 * @remarks
 * `KeyboardShortcutList` の子として置く。説明を `dt`、キーを `dd` として組にするため、支援技術は
 * どの操作に対するキーかを対応付けられる。
 *
 * キーの表示だけは閲覧環境で表記が変わるため client island になるが、この component 自体は
 * 表示専用の Server Component である。
 *
 * **キーだけを置かない。** キーから何が起きるかは推測できないため、説明を必ず children に渡す。
 * キーボードから実行できない操作は載せない。
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.keys - 押す順に並べたキー。
 * @param props.platform - 表記を固定するプラットフォーム。{@link SHORTCUT_PLATFORM} のいずれか。
 *
 * @see Storybook `Display/KeyboardShortcut`
 */
export function KeyboardShortcut({
  children,
  className,
  keys,
  platform,
  ...props
}: KeyboardShortcutProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-4", className)}
      data-slot="keyboard-shortcut"
      {...props}
    >
      <dt className="min-w-0 text-sm">{children}</dt>
      <dd className="shrink-0">
        <KeyboardShortcutKeys keys={keys} platform={platform} />
      </dd>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import { NavigationGuard } from "@/components/app-starter/navigation-guard/navigation-guard";
import { UnloadGuard } from "@/components/app-starter/unload-guard/unload-guard";

const TITLE = "移動しますか？";
const DESCRIPTION = "編集中の内容は保存されませんが移動しますか？";

/**
 * 書きかけの申告先。
 *
 * @remarks
 * 器の外から申告できないよう、context そのものは公開しません。申告は {@link useUnsavedChanges}、
 * 読み取りは器の内側だけです。
 */
const UnsavedChangesContext = createContext<((hasUnsavedChanges: boolean) => void) | undefined>(
  undefined,
);

/** `UnsavedChangesGuard` の props。 */
export type UnsavedChangesGuardProps = {
  /** 見張る範囲。この配下の link click を傍受する。 */
  children: ReactNode;
};

/**
 * 書きかけがあるあいだ、画面を離れる操作を確認する器。
 *
 * @remarks
 * **書きかけかどうかを自分では決めません。** 判断するのは入力を持つ画面で、ここは
 * {@link useUnsavedChanges} を通じた申告を読むだけです。器の側が判断すると、どの入力を数えるかを
 * 器が知ることになります。
 *
 * 器の階層に置くのは、離れる操作の起点が**画面の外**にあるためです。パンくずも脇の一覧も画面
 * より上にあり、画面の内側から包めません。申告する画面と器のあいだに props の経路が無いのは
 * page と layout が別の木だからで、その 1 段だけを context が繋ぎます。
 *
 * **横断 client 状態の store には上げません。** 使うのがこの feature の画面だけである以上、
 * 受入基準（複数 feature の参照）を満たしません。2 つ目の feature が申告するようになった時点で
 * 昇格させます。
 *
 * 永続化しません。リロードすれば書きかけは失われており、申告だけが残ると出る理由の無い確認が
 * 出ます。
 *
 * アプリ内の移動とリロード / タブを閉じるは別の経路なので、2 つの部品を併せて使います。
 * browser の戻る / 進むはどちらでも塞げません（`NavigationGuard` の README）。
 */
export function UnsavedChangesGuard({ children }: UnsavedChangesGuardProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  return (
    <UnsavedChangesContext.Provider value={setHasUnsavedChanges}>
      <NavigationGuard description={DESCRIPTION} title={TITLE} when={hasUnsavedChanges}>
        <UnloadGuard when={hasUnsavedChanges} />
        {children}
      </NavigationGuard>
    </UnsavedChangesContext.Provider>
  );
}

/**
 * 書きかけがあることを器へ申告する。
 *
 * @remarks
 * 申告は器が持つ状態への同期なので effect で行います。画面を離れるときは必ず取り下げます。
 * 取り下げないと、次に開いた画面が何も書いていないのに確認を出します。
 *
 * 器の外で呼ばれたときは何もしません。申告先が無いのは「この画面は器に包まれていない」という
 * ことで、確認を出す相手が居ません。
 */
export function useUnsavedChanges(hasUnsavedChanges: boolean): void {
  const setHasUnsavedChanges = useContext(UnsavedChangesContext);

  useEffect(() => {
    if (setHasUnsavedChanges === undefined) return;

    setHasUnsavedChanges(hasUnsavedChanges);

    return () => setHasUnsavedChanges(false);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);
}

"use client";

import { useCallback, useSyncExternalStore } from "react";

/** サーバでは回線の有無を判定できないため、繋がっている側を返す。 */
function serverSnapshot(): boolean {
  return true;
}

/**
 * 回線が繋がっているかを購読する。
 *
 * @remarks
 * **サーバでは常に `true` を返します。** 繋がっていない端末へ配るのはキャッシュされた応答なので、
 * 初回描画は繋がっている姿になり、hydration の後に実際の状態へ移ります。
 *
 * **これは runtime の能力であって、通信が成立しているかではありません。** ブラウザが言うのは
 * 「網に繋がる口があるか」までで、その先の相手が応答するかは含みません。個々の接続が生きて
 * いるかは、その接続を持っている側が持ちます。
 *
 * @returns 回線が繋がっているか
 */
export function useOnlineStatus(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    globalThis.addEventListener("online", onStoreChange);
    globalThis.addEventListener("offline", onStoreChange);

    return () => {
      globalThis.removeEventListener("online", onStoreChange);
      globalThis.removeEventListener("offline", onStoreChange);
    };
  }, []);

  return useSyncExternalStore(subscribe, () => navigator.onLine, serverSnapshot);
}

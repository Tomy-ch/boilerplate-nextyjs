import "server-only";

import { getMediaConfig } from "@/config/media/media.server";
import { mediaUrl } from "@/model/media";

/**
 * 設定された配信元でオブジェクトキーを URL へ解決する。
 *
 * @remarks
 * 配信元は設定から来ます。設定を読めるのは `adapters` までで、feature は読めません。
 * 組み立ての規則そのものは `model` が持ち、ここは配信元を束ねるだけです。
 */
export function resolveMediaUrl(imagePath: string | null): string | null {
  return mediaUrl(getMediaConfig().origin, imagePath);
}

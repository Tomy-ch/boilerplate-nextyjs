import { type GeneratedFile, type GenerationInput, featureLocation } from "./plan";

/**
 * 計画が既に在るものへ触らないかを判定する。
 *
 * @remarks
 * 上書きしない保証はここが持ちます。存在の問い合わせは入口から受け取り、ここはファイルシステムに
 * 触りません。feature の画面はディレクトリが在るだけで止めます —— 生成物と同名のファイルが
 * 無くても、人が置いたものの隣へ雛形を混ぜないためです。
 */

/**
 * 計画が触ってしまう既存のパスを挙げる。
 *
 * @param exists - リポジトリルート相対のパスが在るか
 * @returns 空なら書き出してよい。空でなければ、利用者へ見せるパスの並び。
 */
export function collisionsOf(
  input: GenerationInput,
  files: readonly GeneratedFile[],
  exists: (path: string) => boolean,
): readonly string[] {
  if (input.kind === "feature") {
    const { screenDirectory } = featureLocation(input.name, input.placement.screen);

    if (exists(screenDirectory)) {
      return [`${screenDirectory}/`];
    }
  }

  return files.map((file) => file.path).filter(exists);
}

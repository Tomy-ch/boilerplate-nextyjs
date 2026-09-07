/**
 * `--name=value` 形式の引数から値を取り出す。
 *
 * @remarks
 * `pnpm gen` の配置オプションはすべてこの綴りで、`pnpm add:ui` と同じにしてあります。
 * 綴りを 1 箇所に置くのは、種類ごとに読み方が割れると同じ引数が片方でだけ通るためです。
 *
 * @param options - `<name>` より後ろの引数
 * @param option - `--` を含む名前
 * @returns 最初に現れた値。無ければ `undefined`
 */
export function optionValue(options: readonly string[], option: string): string | undefined {
  const prefix = `${option}=`;

  return options.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

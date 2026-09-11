import { validateName } from "./naming";
import { optionValue } from "./option-value";

/**
 * `pnpm gen feature` の配置オプションを読む。
 *
 * @remarks
 * feature の中は画面を第 1 軸に掘るので、雛形は画面 1 つぶんを `--screen=<画面>` で受け取ります。
 * 画面名も kebab-case で、`view` / `page-content` の識別子はそこから導きます。画面ディレクトリを
 * 最初から持たせるのは、2 つ目の画面が来たときに 1 つ目を移す作業を無くすためで、2 つ目以降も
 * 同じオプションで足します。
 */

const SCREEN_OPTION = "--screen";

export type FeaturePlacement = {
  /** kebab-case の画面名。`features/<name>/<screen>/` の `<screen>`。 */
  readonly screen: string;
};

/** 読み取りの結果。配置が定まったか、利用者へ見せる 1 行か。 */
export type FeaturePlacementResult =
  | { readonly placement: FeaturePlacement }
  | { readonly error: string };

/**
 * オプション列から、feature に足す画面を決める。
 *
 * @param options - `<name>` より後ろの引数。`--screen=<画面>` は必須。
 */
export function readFeaturePlacement(options: readonly string[]): FeaturePlacementResult {
  const unknown = options.find((argument) => !argument.startsWith(`${SCREEN_OPTION}=`));

  if (unknown !== undefined) {
    return {
      error: `引数 "${unknown}" は受け付けません。画面は ${SCREEN_OPTION}=<画面> で指定してください。`,
    };
  }

  const screen = optionValue(options, SCREEN_OPTION);

  if (screen === undefined) {
    return {
      error: `${SCREEN_OPTION}=<画面> は必須です。feature は画面ごとに掘るので、足す画面を kebab-case で指定してください（例: ${SCREEN_OPTION}=list）。`,
    };
  }

  const nameError = validateName(screen);

  if (nameError !== null) {
    return { error: `${SCREEN_OPTION} の${nameError}` };
  }

  return { placement: { screen } };
}

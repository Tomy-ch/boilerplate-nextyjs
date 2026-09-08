// GitHub のラベル宣言（.github/settings/labels.json）の読み取りと、実在との差分。
import { z } from "zod";

/** ラベルの宣言ファイル。リポジトリルート相対。 */
export const LABELS_PATH = ".github/settings/labels.json";

// gh label create が受ける色は先頭の `#` を持たない 6 桁の 16 進数。宣言側で確定させる。
const COLOR_PATTERN = /^[0-9a-fA-F]{6}$/;

const labelSchema = z.object({
  name: z.string().min(1, { error: "name が空です" }),
  description: z.string(),
  color: z.string().regex(COLOR_PATTERN, { error: "color は # を持たない 6 桁の 16 進数です" }),
});

const labelsSchema = z.array(labelSchema).min(1, { error: "ラベルの宣言が空です" });

/** ラベル 1 件の宣言。 */
export type LabelSpec = z.infer<typeof labelSchema>;

/** 宣言と実在の差分。 */
export type LabelDiff = {
  /** 実在しないので作るもの。宣言された順のまま。 */
  readonly toCreate: readonly LabelSpec[];
  /** すでに実在するので触らないものの名前。宣言された順のまま。 */
  readonly alreadyPresent: readonly string[];
};

/**
 * ラベルの宣言を読み取る。
 *
 * @remarks
 * **形が崩れた宣言は落とします。** 読めなかった宣言を 0 件へ縮退させると、ラベルを 1 つも
 * 作らないまま正常終了し、初期化が済んだように見えます。
 *
 * name の重複も拒否します。重複はそのまま同じ名前を二度作りにいくことになり、2 件目が
 * GitHub 側で弾かれるところまで進んでからでないと気づけないためです。
 */
export function parseLabelSpecs(source: string): LabelSpec[] {
  const parsed: unknown = JSON.parse(source);
  const labels = labelsSchema.parse(parsed);
  const seen = new Set<string>();

  for (const label of labels) {
    if (seen.has(label.name)) {
      throw new Error(`name "${label.name}" が重複しています`);
    }

    seen.add(label.name);
  }

  return labels;
}

/**
 * 宣言のうち作るものと、すでに在るものを分ける。
 *
 * @param existing リポジトリに実在するラベル名の全数
 * @param desired 宣言されたラベル
 *
 * @remarks
 * **実在する側は宣言と照らして作り直しません。** 色や説明の差までは見ず、名前の有無だけで
 * 分けます。作り直しは人が付けたラベルの説明を宣言側の値で黙って上書きすることになり、
 * この道具が担うのは初期化であって同期ではないためです。
 */
export function diffLabels(existing: readonly string[], desired: readonly LabelSpec[]): LabelDiff {
  const present = new Set(existing);
  const toCreate: LabelSpec[] = [];
  const alreadyPresent: string[] = [];

  for (const label of desired) {
    if (present.has(label.name)) {
      alreadyPresent.push(label.name);
    } else {
      toCreate.push(label);
    }
  }

  return { toCreate, alreadyPresent };
}

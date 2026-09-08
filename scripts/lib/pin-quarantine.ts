// 供給網検疫。公開から日が浅い解決先を採用しない。目的は `scripts/README.md` が挙げる関連 ADR
// （セキュリティ運用）が持つ。
//
// 固定する対象（GitHub Actions の SHA / container image の digest）によらず判断は同じで、
// 違うのは経過日数の調べ方だけ。その差は ageOf として外から渡す。

/** 検疫の判定結果。use が null なら採用しない（ロックファイルへ書かない）。 */
export type QuarantineResult = {
  use: string | null;
  note: string | null;
};

/**
 * minAgeDays 未満の新しすぎる解決先は採用しない。
 *
 * @remarks
 * 既存ピンがあればそれを維持し、無ければ採用を見送ります。minAgeDays が 0 以下なら検疫を
 * 行わず、経過日数の問い合わせもしません。
 */
export async function quarantine(
  ageOf: () => Promise<number>,
  key: string,
  candidate: string,
  minAgeDays: number,
  existing: Map<string, string>,
): Promise<QuarantineResult> {
  if (minAgeDays <= 0) return { use: candidate, note: null };
  const age = await ageOf();
  if (age >= minAgeDays) return { use: candidate, note: null };

  const previous = existing.get(key);
  if (previous !== undefined) {
    return {
      use: previous,
      note: `${key}: 解決先が ${age} 日 (<${minAgeDays}) のため既存ピンを維持`,
    };
  }

  return {
    use: null,
    note: `${key}: 解決先が ${age} 日 (<${minAgeDays})・既存ピン無しのため skip`,
  };
}

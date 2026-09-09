// setup-mise が固定する mise の版と digest が、キャッシュキーと揃っているかの判定。
//
// 同じ値が 2 度書かれるのは composite action の都合である。`with:` からステップの `env:` を
// 参照できないため、キャッシュキーは値を直接埋めるしかない。
//
// 揃っていないと、壊れ方が「落ちるが理由が分からない」になる。版だけ上げればキーが変わって
// 取得し直し digest 照合で落ち、digest だけ直せばキーが変わらず古い実体を復元し続けて
// やはり照合で落ちる。どちらも fail-closed だが、原因に辿り着くまでが遠い。

/** 判定の材料。action 定義から読み取った 3 つの値。 */
export type MisePin = {
  /** `MISE_VERSION` の値。 */
  version: string | null;
  /** `MISE_SHA256` の値。 */
  digest: string | null;
  /** キャッシュの `key:` の値。 */
  cacheKey: string | null;
};

const VERSION_PATTERN = /^[ \t]*MISE_VERSION:[ \t]*(\S+)[ \t]*$/m;
const DIGEST_PATTERN = /^[ \t]*MISE_SHA256:[ \t]*(\S+)[ \t]*$/m;
const CACHE_KEY_PATTERN = /^[ \t]*key:(.*)$/m;
/** キャッシュキーへ埋める digest の桁数。全 64 桁はキーが読めなくなるため頭だけを使う。 */
export const DIGEST_PREFIX_LENGTH = 8;

/** action 定義から版・digest・キャッシュキーを読み取る。 */
export function readPin(source: string): MisePin {
  return {
    version: VERSION_PATTERN.exec(source)?.[1] ?? null,
    digest: DIGEST_PATTERN.exec(source)?.[1] ?? null,
    cacheKey: CACHE_KEY_PATTERN.exec(source)?.[1]?.trim() || null,
  };
}

/**
 * 3 つの値が揃っているかを判定し、違反を人が読める文で返す。
 *
 * @remarks
 * 値のどれかを読み取れない場合も違反として報告します。読み取れないまま「違反なし」を返すと、
 * 検査が成立していない状態が合格として通ります。
 */
export function findViolations(pin: MisePin): string[] {
  const violations: string[] = [];
  if (pin.version === null) violations.push("MISE_VERSION を読み取れません");
  if (pin.digest === null) violations.push("MISE_SHA256 を読み取れません");
  if (pin.cacheKey === null) violations.push("キャッシュの key を読み取れません");
  if (pin.version === null || pin.digest === null || pin.cacheKey === null) return violations;

  if (!pin.cacheKey.includes(pin.version)) {
    violations.push(
      `キャッシュキーが版を含んでいません（版 ${pin.version} / キー ${pin.cacheKey}）。版を上げてもキーが変わらず、古い実体を復元し続けます`,
    );
  }

  const prefix = pin.digest.slice(0, DIGEST_PREFIX_LENGTH);
  if (!pin.cacheKey.includes(prefix)) {
    violations.push(
      `キャッシュキーが digest の先頭 ${DIGEST_PREFIX_LENGTH} 桁を含んでいません（${prefix} / キー ${pin.cacheKey}）。digest を差し替えてもキーが変わらず、古い実体を復元し続けます`,
    );
  }

  return violations;
}

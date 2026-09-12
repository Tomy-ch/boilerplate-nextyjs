// ロックファイルが持つ 1 件の固定を、キーと値へ / から翻訳する。
//
// 読み書きの実体は [pin-lockfile](../lib/pin-lockfile.ts) が持つ（Actions の SHA・image の
// digest と同じ性質を守るため）。ここが持つのは、この対象のキーの文法だけである。
import { RULES_REPO } from "./manifest.js";

/** ロックファイルが持つ固定 1 件。 */
export type RulesPin = {
  commit: string;
  /** 取り出したルール集合の digest。 */
  digest: string;
};

// 供給元の名前をそのまま正規表現へ入れない。`.` や `-` を含みうる文字列で、字面のまま埋めると
// 別の綴りのキーに一致しうる。
function escapeForPattern(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

const KEY_PATTERN = new RegExp(`^${escapeForPattern(RULES_REPO)}@([0-9a-f]{40})$`);

/**
 * 固定 1 件をロックファイルのキーにする。
 *
 * @param commit - 固定する commit（40 桁の小文字 16 進）
 */
export function pinKey(commit: string): string {
  return `${RULES_REPO}@${commit}`;
}

/**
 * ロックファイルの中身から固定を 1 件だけ取り出す。
 *
 * @remarks
 * **1 件でなければ落とします。** 0 件は固定が無いまま走査しようとしている状態で、そのまま
 * 進めば「ルール 0 件で所見 0 件」という、検査していないことと違反が無いことの見分けが
 * 付かない結果を返します。2 件以上は、commit を上げた人が古い行を消していない状態で、
 * どちらで走るかが列挙順に委ねられます。
 *
 * @param lock - {@link readLock} が返した対応
 * @throws 件数が 1 でないとき、キーが読めないとき
 */
export function readPin(lock: ReadonlyMap<string, string>): RulesPin {
  const entries = [...lock.entries()];
  if (entries.length !== 1) {
    throw new Error(
      `固定は 1 件でなければなりません（${entries.length} 件あります）。commit を上げたなら古い行を消してください。`,
    );
  }

  const [key, digest] = entries[0] as [string, string];
  const matched = KEY_PATTERN.exec(key);
  if (!matched) {
    throw new Error(`キーが読めません（"${RULES_REPO}@<40 桁の commit>" の形で書きます）: ${key}`);
  }

  return { commit: matched[1] as string, digest };
}

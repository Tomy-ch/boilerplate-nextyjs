// 固定対象 → 固定値のロックファイル(SSOT)の読み書き。
//
// 形式は TOML の妥当な部分集合(`"<キー>" = "<値>"` の行だけ)に限定し、読み書きとも自前の
// 正規表現で行う。パーサを入れないのは、書き出す側と読む側が同じ制約を共有していれば依存
// なしで往復でき、想定外の TOML 構文が紛れ込む余地も同時に消えるため。
//
// 固定する対象(GitHub Actions の SHA / container image の digest)ごとにキーと値の文法は
// 違うが、ロックファイルとして守る性質は同じ。壊れた行を読み飛ばさないこと、キーの重複を
// 通さないこと、キー順で書き出すことは、どちらの対象でも同じ理由で要る。
import fs from "node:fs";

const FILE_MODE = 0o644;
const ENTRY_PATTERN = /^"([^"]+)"[ \t]*=[ \t]*"([^"]*)"$/;

/** ロックファイルの文法。固定する対象ごとに与える。 */
export type LockFormat = {
  /** 1 行の書き方。代入形でない行を報告するときに、正しい形として示す。 */
  entryLabel: string;
  /** 値が満たすべき形。 */
  value: RegExp;
  /** 値の形の呼び名。読めない値を報告するときの主語になる。 */
  valueLabel: string;
  /** 書き出す先頭に置く説明行。 */
  header: readonly string[];
};

/**
 * ロックファイルを読む。
 *
 * @remarks
 * コメント行と空行以外が代入形でない、または値が `format` の形でない場合は例外を投げます。
 * 壊れた行を読み飛ばすと、そのエントリが未登録として扱われるか、不正な値がそのまま固定先へ
 * 書き込まれます。
 */
export function readLock(file: string, format: LockFormat): Map<string, string> {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const lock = new Map<string, string>();
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const [, key, value] = ENTRY_PATTERN.exec(line) ?? [];
    if (key === undefined || value === undefined) {
      throw new Error(`${file}:${index + 1} 形式が不正です（${format.entryLabel}）: ${raw}`);
    }
    if (!format.value.test(value)) {
      throw new Error(`${file}:${index + 1} ${format.valueLabel}ではありません: ${value}`);
    }
    // 後勝ちで上書きすると、どちらの値が実際に使われるかが行順に依存する。マージ衝突を
    // 機械的に解消すると同一キーが 2 行残るため、現実に起こりうる破損。
    if (lock.has(key)) {
      throw new Error(`${file}:${index + 1} キーが重複しています: ${key}`);
    }
    lock.set(key, value);
  }

  return lock;
}

/**
 * 初回 resolve のためにファイル不在だけを空として許容して読む。
 *
 * @remarks
 * 権限エラーや壊れた行は握り潰しません。既存ピンが黙って脱落すると、検疫の「既存ピンを
 * 維持」が働かなくなります。
 */
export function readLockOrEmpty(file: string, format: LockFormat): Map<string, string> {
  try {
    return readLock(file, format);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw e;
  }
}

/** ロックファイルをキー順で書き出す。 */
export function writeLock(file: string, lock: Map<string, string>, format: LockFormat): void {
  const entries = [...lock.keys()].sort().map((key) => `"${key}" = "${lock.get(key)}"\n`);
  fs.writeFileSync(file, `${format.header.join("\n")}\n${entries.join("")}`, { mode: FILE_MODE });
}

// 取得済みの契約から型 / zod / MSW ハンドラを作り直す判定（make api-gen の本体）。
//
// **消すのではなく退避してから生成する。** 生成が途中で失敗したとき、消した後だと生成物の無い
// 作業ツリーだけが残る。退避なら書き戻せる。lockfile のずれ・契約の不正・抽出の失敗のどれで
// 落ちても同じ経路で戻すため、失敗の種類ごとに事前確認を足していく形にはしない。
//
// 遣り取りそのものは gen-api.ts が持つ。ここが触るのは差し替えられる入出力だけである。

/**
 * 生成物の置き場。`orval.config.ts` の target / schemas と 1 対 1 で対応する。
 *
 * @remarks
 * **手書きを含めてはいけません。** `src/adapters/gen/README.md` と `mocks/` 直下は人が書いた
 * ものなので、消してよいのは契約ごとの部分木だけです。
 *
 * **末尾の `api` は契約の名前で、`openapi/sources.yaml` の `name` と揃えます。** 同じ綴りが
 * `orval.config.ts` にも入っており、**片方だけ動かしても型検査も lint も通ってしまいます**。
 * ずれは `make api-gen-check` が「生成物がありません」として遅れて知らせます。
 */
const GEN_API_OUTPUTS: readonly string[] = ["src/adapters/gen/api", "mocks/api"];

/**
 * 生成のあいだ、既存の生成物を置いておく場所。生成が失敗したらここから書き戻す。
 *
 * @remarks
 * **作業ツリーの中を指します。** 退避は名前の付け替えで行うため、別のファイルシステム
 * （`/tmp` など）を指すと動かせません。
 */
const GEN_API_BACKUP = "tmp/gen-api-backup";

/** 生成物 1 件の移動。`from` を `to` へ動かす。 */
export type StashMove = {
  readonly from: string;
  readonly to: string;
};

/** 生成に失敗したときの復旧手順。`remove` を消してから `moves` を書き戻す。 */
export type RestorePlan = {
  /** 生成の途中で出来たものを落とすために消す位置。 */
  readonly remove: readonly string[];
  /** 退避から書き戻す移動。 */
  readonly moves: readonly StashMove[];
};

/** 外との遣り取り。`runGenApi` はここを通してしか作業ツリーへ触らない。 */
export type GenApiIo = {
  readonly exists: (path: string) => boolean;
  /** 在っても無くても消す（`rm -rf`）。 */
  readonly remove: (path: string) => void;
  /** 親ごと作って動かす（`mkdir -p` + `mv`）。 */
  readonly move: (from: string, to: string) => void;
  /** 子プロセスを走らせ、正常終了したかを返す。 */
  readonly run: (command: string, args: readonly string[]) => boolean;
  readonly warn: (message: string) => void;
};

/**
 * 退避する生成物を選ぶ。
 *
 * @param outputs 生成物の置き場の全数
 * @param backupRoot 退避先の根
 * @param exists その位置に何か在るか
 *
 * @remarks
 * **退避先は生成物の相対位置をそのまま写します。** 置き場どうしは名前が衝突しうる
 * （`src/adapters/gen/api` と `mocks/api` の末尾はどちらも `api`）ため、末尾だけを退避先の
 * 名前に採ると片方がもう片方を上書きし、書き戻しで取り違えます。
 */
export function planStash(
  outputs: readonly string[],
  backupRoot: string,
  exists: (path: string) => boolean,
): StashMove[] {
  return outputs
    .filter((output) => exists(output))
    .map((output) => ({ from: output, to: `${backupRoot}/${output}` }));
}

/**
 * 生成に失敗したときの復旧手順を組み立てる。
 *
 * @param outputs 生成物の置き場の全数
 * @param stashed 実際に退避した移動
 *
 * @remarks
 * **消すのは置き場の全数で、書き戻すのは退避したものだけです。** 生成は途中まで進んでいる
 * ことがあり、退避しなかった置き場（生成前に存在しなかったもの）にも書きかけが残ります。
 * 消す側を退避した分だけに絞ると、それが生成物の顔をして居座ります。
 */
export function planRestore(
  outputs: readonly string[],
  stashed: readonly StashMove[],
): RestorePlan {
  return {
    remove: [...outputs],
    moves: stashed.map((move) => ({ from: move.to, to: move.from })),
  };
}

/**
 * 生成物を退避してから作り直し、失敗したら書き戻す。
 *
 * @returns 生成できたか。呼び出し側はこれを終了コードへ変える
 *
 * @remarks
 * **空から作ります。** 上書きだけだと、契約から消えたスキーマに対応するファイルが再生成で
 * 触られずに残ります。中身が変わらないので drift ゲートの突合も素通りし、契約に無いものが
 * 生成物の顔をして居座ります。空から作れば、消えたものは消えた状態で現れます。
 *
 * 生成は 2 段（orval と定数の抽出）で、前段が落ちたら後段は走らせません。抽出は orval の
 * 出力を読むため、走らせても前回の出力から作った定数を新しい契約の顔で置くだけになります。
 */
export function runGenApi(io: GenApiIo): boolean {
  io.remove(GEN_API_BACKUP);

  const stashed = planStash(GEN_API_OUTPUTS, GEN_API_BACKUP, io.exists);

  for (const move of stashed) {
    io.move(move.from, move.to);
  }

  const generated =
    io.run("pnpm", ["exec", "orval"]) &&
    io.run("pnpm", ["exec", "tsx", "scripts/openapi/extract-limits.ts"]);

  if (generated) {
    io.remove(GEN_API_BACKUP);

    return true;
  }

  io.warn("❌ 生成に失敗しました。退避した生成物を書き戻します。");

  const restore = planRestore(GEN_API_OUTPUTS, stashed);

  for (const target of restore.remove) {
    io.remove(target);
  }

  for (const move of restore.moves) {
    io.move(move.from, move.to);
  }

  io.remove(GEN_API_BACKUP);

  return false;
}

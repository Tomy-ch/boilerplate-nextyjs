// 取得した契約へ「どの版を取り込んだか」を焼き込む。
import { isScalar, parseDocument, Scalar } from "yaml";

const SHORT_SHA_LENGTH = 7;
const BLOB_SHA_PATTERN = /^[0-9a-f]{7,40}$/;
// 末尾へ文字を足しても値の終端が変わらない書き方だけを受け付ける。ブロックスカラー（`|` / `>`）は
// 位置が本文末尾までを指すため、その後ろへ連結すると次のキーが版の一部として飲み込まれる。
const STAMPABLE_SCALAR_TYPES: readonly string[] = [
  Scalar.PLAIN,
  Scalar.QUOTE_SINGLE,
  Scalar.QUOTE_DOUBLE,
];

/** 取得物の先頭に置く do-not-edit ヘッダ。 */
export const CONTRACT_HEADER = [
  "# do-not-edit: このファイルは make api-fetch が取得した上流の契約です。",
  "# 取得座標は openapi/sources.yaml が持ちます。手で編集しても次の取得で失われます。",
  "",
].join("\n");

/**
 * blob SHA を short SHA へ詰める。
 *
 * @remarks
 * 16 進以外を拒否します。スタンプは版の同一性の根拠であり、取得経路が壊れて空文字列や
 * エラーメッセージが流れ込んだときに、それらしい版として通ってしまうのを防ぎます。
 */
export function toShortSha(sha: string): string {
  if (!BLOB_SHA_PATTERN.test(sha)) {
    throw new Error(`blob SHA の形式ではありません: ${sha}`);
  }

  return sha.slice(0, SHORT_SHA_LENGTH);
}

/**
 * 解析済みスカラーが元テキストのどこにあるかを返す。
 *
 * @remarks
 * 文書の解析結果ではないノード（プログラムで組み立てたノード）は位置を持たないため拒否します。
 */
export function scalarRange(node: Scalar): [number, number] {
  if (node.range == null) {
    throw new Error("解析結果ではないノードには位置がありません");
  }

  const [start, end] = node.range;

  return [start, end];
}

/**
 * 契約の `info.version` 末尾へ short SHA を付与する。
 *
 * @remarks
 * YAML を再構築せず該当スカラーだけを差し替えます。契約は上流の生成物であり、取り込み側の
 * 整形で全体が書き換わると、上流との差分がスタンプ以外にも現れて「取り込み側が手を入れたのか
 * 上流が変わったのか」を読み分けられなくなるためです。同じ理由で版の文字列も解析値ではなく
 * 元テキストから取ります（`1.0` を解析値から組み直すと `1` に化けます）。
 *
 * 既存の build metadata（`+` 以降）は捨てて付け直します。再取得のたびに版が伸び続けると、
 * 版そのものが取得回数の記録に化けるためです。
 */
export function stampContractVersion(spec: string, sha: string): string {
  const shortSha = toShortSha(sha);
  const version = parseDocument(spec).getIn(["info", "version"], true);

  if (!isScalar(version)) {
    throw new Error("契約に info.version がありません");
  }

  if (!STAMPABLE_SCALAR_TYPES.includes(String(version.type))) {
    throw new Error(`スタンプできない info.version の書き方です（${String(version.type)}）`);
  }

  const [start, end] = scalarRange(version);
  const raw = spec.slice(start, end);
  // 引用の有無は上流の書き方に従う。無引用の版へ引用符を足すと、スタンプ以外の差分になる。
  const quote = raw.startsWith('"') || raw.startsWith("'") ? raw[0] : "";
  const base = (quote === "" ? raw : raw.slice(1, -1)).split("+")[0];

  if (base === "") {
    throw new Error("契約の info.version が空です");
  }

  return `${spec.slice(0, start)}${quote}${base}+${shortSha}${quote}${spec.slice(end)}`;
}

/** 取得物として書き出す本文。ヘッダとスタンプの両方を持つ。 */
export function buildContractArtifact(spec: string, sha: string): string {
  return `${CONTRACT_HEADER}${stampContractVersion(spec, sha)}`;
}

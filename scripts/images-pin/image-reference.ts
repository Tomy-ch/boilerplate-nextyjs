// container image 参照の走査と解釈。固定対象ファイルの列挙と、行から参照 1 件を取り出す
// 責務を持つ。
//
// 対象は compose の `image:`、Dockerfile の `FROM`、workflow / composite action の
// `uses: docker://`。いずれも「接頭辞・参照・接尾辞」の 3 つに割れるため、書き換えは同じ
// 関数で扱える。
import fs from "node:fs";
import path from "node:path";
import { blockScalarLines } from "../lib/block-scalar.js";
import {
  COMPOSITE_ACTION_DIR,
  collectActionDefinitions,
  readDirOrEmpty,
} from "../lib/composite-action-files.js";
import { groupAt } from "../lib/regex-groups.js";

/** container image の参照 1 件。key は `image:tag`。 */
export type ImageRef = {
  /** 例: `alpine` / `mcr.microsoft.com/playwright`。 */
  image: string;
  /** 例: `3.24` / `v1.62.0-noble`。 */
  tag: string;
};

/** 走査するファイルと、その参照行を捕まえるパターン。 */
export type PinTarget = {
  file: string;
  /** 参照行。第 1 群が接頭辞、第 2 群が参照、第 3 群が接尾辞。 */
  pattern: RegExp;
  /** 厳格なパターンで拾えなかった行を検出するパターン。 */
  loose: RegExp;
  /**
   * tag を持たなくても固定対象外として正当な参照値。
   *
   * @remarks
   * tag の省略は `:latest` を意味するため、原則は取りこぼしとして落とします。Dockerfile だけは
   * registry の image を指さない `FROM` が正当に存在する——先行する `AS` で宣言したビルド
   * ステージと `scratch` で、どちらも固定のしようがありません。持たない対象では未定義です。
   */
  exemptTagless?: (data: string) => ReadonlySet<string>;
};

// 走査用パターンは対象 1 件ごとに作る。`g` 付きの RegExp は `lastIndex` を持ち回り、`matchAll`
// はその時点の値から走査するため、共有すると collectRefs が先頭付近の参照を黙って読み飛ばしうる。

// compose service の `image: <ref>`。接尾辞は行末の空白と行コメントを取り込んで保つ。
// 引用符を参照から締め出すのは、含めると `image: "alpine:3.24"` が引用符ごと一致し、
// `"alpine` を image 名として固定対象に載せてしまうため。締め出せば一致しなくなり、
// unparsedLines が対応記法の外として拾う。
export function composeImagePattern(): RegExp {
  return /^([ \t]+image:[ \t]+)([^\s'"#]+)([ \t]*(?:#.*)?)$/gm;
}
const COMPOSE_IMAGE_LOOSE = /^[ \t]+image[ \t]*:[ \t]*\S/;

// FROM [--platform=...] <ref> [AS <stage>]
export function dockerfileFromPattern(): RegExp {
  return /^(FROM[ \t]+)(?:--platform=\S+[ \t]+)?([^\s'"]+)((?:[ \t]+as[ \t]+\S+)?[ \t]*)$/gim;
}
const DOCKERFILE_FROM_LOOSE = /^[ \t]*FROM[ \t]+\S/i;

// `FROM <ref> AS <stage>` の接尾辞から宣言されたステージ名を取り出す。
const FROM_STAGE_NAME = /\bas[ \t]+(\S+)/i;

// registry の image を指さない `FROM` の値。ビルドステージ参照は Docker が大文字小文字を
// 区別しないため、比較は小文字へ揃える。
function dockerfileExemptTagless(data: string): ReadonlySet<string> {
  const exempt = new Set(["scratch"]);
  for (const match of data.matchAll(dockerfileFromPattern())) {
    const stage = FROM_STAGE_NAME.exec(groupAt(match, 3))?.[1];
    if (stage) exempt.add(stage.toLowerCase());
  }

  return exempt;
}

// workflow / composite action の `uses: [-] docker://<ref>`。
//
// tag を必須にしてあるのは、省略した参照を通すと parseRef が null を返し、固定対象から静かに
// 外れるため。一致しなければ unparsedLines が対応記法の外として拾う。
export function usesDockerPattern(): RegExp {
  return /^([ \t]*(?:-[ \t]*)?uses:[ \t]*docker:\/\/)((?:[^\s'"@]+\/)?[^\s'"@/:]+:[^\s'"@/]+(?:@[^\s'"]+)?)([ \t]*(?:#.*)?)$/gm;
}
const USES_DOCKER_LOOSE = /\buses[ \t]*:[ \t]*['"]?docker:\/\//;

const COMPOSE_PREFIX = "docker-compose";
const YAML_EXTENSIONS = [".yml", ".yaml"];
const DOCKER_DIR = "docker";
const DOCKERFILE = "Dockerfile";
const WORKFLOW_DIR = ".github/workflows";

export function refKey(ref: ImageRef): string {
  return `${ref.image}:${ref.tag}`;
}

/**
 * 参照文字列を image と tag へ分ける。固定対象でなければ null を返す。
 *
 * @remarks
 * 対象外になるのは、tag を持たない参照（`FROM builder` のようなビルドステージ参照や
 * `scratch`）と、最後の `:` が registry のポート指定だったもの（`localhost:5000/app`）です。
 * 既に付いている digest は捨てて読みます。版の SSOT は tag 側であり、digest はロック
 * ファイルが持つためです。
 */
export function parseRef(reference: string): ImageRef | null {
  const digestAt = reference.indexOf("@");
  const name = digestAt < 0 ? reference : reference.slice(0, digestAt);
  const separator = name.lastIndexOf(":");
  if (separator < 0) return null;
  const image = name.slice(0, separator);
  const tag = name.slice(separator + 1);
  if (tag === "" || tag.includes("/")) return null;

  return { image, tag };
}

/**
 * 固定対象ファイルの一覧。
 *
 * @remarks
 * リポジトリ直下の `docker-compose*.yml` / `*.yaml`、`docker/<用途>/Dockerfile`、そして
 * workflow 定義とリポジトリ内 composite action 定義を集めます。走査対象が静かに空になると、
 * そこに書かれた image 参照が検疫・固定・drift 検査のいずれからも外れたまま「すべて固定済み」と
 * 報告されます。
 *
 * workflow 側で拾うのは `uses: docker://` の行だけです。
 */
export function targetFiles(root: string): PinTarget[] {
  const targets: PinTarget[] = [];

  for (const entry of readDirOrEmpty(root)) {
    if (!entry.isFile() || !entry.name.startsWith(COMPOSE_PREFIX)) continue;
    if (!YAML_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) continue;
    targets.push({
      file: path.join(root, entry.name),
      pattern: composeImagePattern(),
      loose: COMPOSE_IMAGE_LOOSE,
    });
  }

  const dockerDir = path.join(root, DOCKER_DIR);
  for (const entry of readDirOrEmpty(dockerDir)) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dockerDir, entry.name, DOCKERFILE);
    if (!fs.existsSync(file)) continue;
    targets.push({
      file,
      pattern: dockerfileFromPattern(),
      loose: DOCKERFILE_FROM_LOOSE,
      exemptTagless: dockerfileExemptTagless,
    });
  }

  for (const file of workflowFiles(root)) {
    targets.push({ file, pattern: usesDockerPattern(), loose: USES_DOCKER_LOOSE });
  }

  return targets.sort((a, b) => a.file.localeCompare(b.file));
}

/** 対象ファイル群から固定対象の参照をキー単位で集める。同一キーは 1 件に畳む。 */
export function collectRefs(targets: PinTarget[]): Map<string, ImageRef> {
  const refs = new Map<string, ImageRef>();
  for (const target of targets) {
    const data = fs.readFileSync(target.file, "utf8");
    for (const match of data.matchAll(target.pattern)) {
      const ref = parseRef(groupAt(match, 2));
      if (ref) refs.set(refKey(ref), ref);
    }
  }

  return refs;
}

/**
 * 厳格なパターンで解釈できなかった参照行の行番号を返す。
 *
 * @remarks
 * 引用符付き（`image: "alpine:3.24"`）や flow mapping で書かれた参照は、未登録としても
 * 未固定としても数えられず、検査が「異常なし」を返します。固定の網から外れた参照を黙って
 * 通さないよう、対応記法の外を検出して呼び出し元に落とさせます。
 */
export function unparsedLines(data: string, target: PinTarget): number[] {
  const rest = data.replace(target.pattern, (line) => " ".repeat(line.length));
  // 範囲の判定は潰す前の内容で行う。潰した行は字下げごと空白になり、ブロックの終わりに見える。
  const inBlockScalar = blockScalarLines(data);
  const lines: number[] = [];
  for (const [index, line] of rest.split("\n").entries()) {
    if (line.trimStart().startsWith("#")) continue;
    // ブロックスカラーの中身は YAML の構造ではない。`run:` が出力する文字列に反応させない。
    if (inBlockScalar.has(index + 1)) continue;
    if (target.loose.test(line)) lines.push(index + 1);
  }
  lines.push(...taglessLines(data, target));

  return lines.sort((a, b) => a - b);
}

/**
 * 厳格なパターンには一致したが tag を持たない参照の行番号を返す。
 *
 * @remarks
 * この形は上の走査では拾えません——厳格なパターンに一致した時点で空白へ潰され、残らないためです。
 * 一方 `parseRef` は tag が無ければ `null` を返すので固定対象にも載らず、**どの報告にも現れない**
 * まま `:latest` が実行されます。固定の網から参照が黙って消える向きの穴なので、ここで塞ぎます。
 */
function taglessLines(data: string, target: PinTarget): number[] {
  const exempt = target.exemptTagless?.(data) ?? new Set<string>();
  const lines: number[] = [];
  for (const match of data.matchAll(target.pattern)) {
    const reference = groupAt(match, 2);
    if (parseRef(reference) || exempt.has(reference.toLowerCase())) continue;
    lines.push(lineNumberAt(data, match.index));
  }

  return lines;
}

// 文字位置が何行目にあたるか（1 始まり）。
function lineNumberAt(data: string, index: number): number {
  return data.slice(0, index).split("\n").length;
}

// workflow 定義とリポジトリ内 composite action 定義。対象の決め方は actions-pin と同一で
// なければならないため、composite action の走査は共通の実装を使う。
function workflowFiles(root: string): string[] {
  const files: string[] = [];

  const workflowDir = path.join(root, WORKFLOW_DIR);
  for (const entry of readDirOrEmpty(workflowDir)) {
    if (!entry.isFile()) continue;
    if (!YAML_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) continue;
    files.push(path.join(workflowDir, entry.name));
  }
  collectActionDefinitions(path.join(root, COMPOSITE_ACTION_DIR), files);

  return files;
}

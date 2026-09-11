// 取得した契約と、そこから生成した成果物の版が揃っているかの突合。
import type { OpenApiSource } from "./sources-manifest";

// orval が生成物のヘッダへ書き出す契約の版。契約の info.version をそのまま写すため、
// make api-fetch が焼いた short SHA がここに現れる。
const SPEC_VERSION_PATTERN = /OpenAPI spec version:\s*(\S+)/;
const SHORT_SHA_LENGTH = 7;
const MISSING_VERSION = "";

/** 生成物 1 件の照合対象。 */
export type GeneratedArtifact = {
  path: string;
  content: string;
};

/**
 * 契約 1 本の生成物が置かれるディレクトリ。
 *
 * @remarks
 * 突合の対象は特定のファイルではなくディレクトリ全体です。orval は契約の schema ごとに
 * ファイルを分けて出すため、対象を代表 1 ファイルに絞ると、そのファイルが変わらない種類の
 * 契約変更（schema の追加など）を取りこぼします。
 */
export function contractArtifactRoots(name: string): string[] {
  return [`src/adapters/gen/${name}`, `mocks/${name}`];
}

/**
 * 生成物のヘッダから契約の版を取り出す。
 *
 * @remarks
 * 見つからない場合は null を返します。版を持たない生成物は突合の対象外ではなく、
 * 「生成器が版を書かなくなった」という検知すべき変化です。
 */
export function extractSpecVersion(content: string): string | null {
  return SPEC_VERSION_PATTERN.exec(content)?.[1] ?? null;
}

/**
 * 宣言された契約と生成物の版のずれを列挙する。
 *
 * @remarks
 * 契約を取得しただけで生成していない状態を検出します。取得と生成が別コマンドである以上、
 * 片方だけ実行された作業ツリーは必ず作れるため、突合を機械で持つ必要があります。
 *
 * ずれは版ごとにまとめて 1 行にします。契約が動けば生成物は数百件が一斉にずれるため、
 * ファイル単位で並べると出力が原因ではなく規模で埋まります。
 */
export function findStampDrift(
  sources: readonly OpenApiSource[],
  artifacts: readonly GeneratedArtifact[],
): string[] {
  const drift: string[] = [];

  for (const source of sources) {
    if (source.sha === null) {
      drift.push(`${source.name}: 契約が未取得です`);
      continue;
    }

    const roots = contractArtifactRoots(source.name);
    const owned = artifacts.filter((artifact) =>
      roots.some((root) => artifact.path.startsWith(`${root}/`)),
    );

    if (owned.length === 0) {
      drift.push(`${source.name}: 生成物がありません`);
      continue;
    }

    const expected = `+${source.sha.slice(0, SHORT_SHA_LENGTH)}`;
    const byVersion = new Map<string, string[]>();

    for (const artifact of owned) {
      const version = extractSpecVersion(artifact.content) ?? MISSING_VERSION;

      if (version.endsWith(expected)) {
        continue;
      }

      byVersion.set(version, [...(byVersion.get(version) ?? []), artifact.path]);
    }

    for (const [version, paths] of byVersion) {
      const found = version === MISSING_VERSION ? "版を持ちません" : `版 ${version} です`;

      drift.push(
        `${source.name}: 契約は ${expected} ですが ${paths.length} 件が${found}（例: ${paths[0]}）`,
      );
    }
  }

  return drift;
}

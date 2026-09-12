// 資格情報を要するスキャナ 1 製品分の撤去宣言。ここはデータだけを持ち、撤去の手順は入口
// ([index.ts](index.ts))が担う。
//
// **文書は書き換えない。**ゲートが見るもの（ファイル・pin・宛先の宣言）だけを機械で始末し、
// 製品名を残している文書は**一覧として報告する**。複製したリポジトリは ADR も文書も上書きして
// 使う前提なので、表の行を完全一致で切り出す機構を持つと、**動いた行に静かに素通りされる側**
// の危険だけが残る（[0157](../../../docs/adr/0157-inspection-declaration-discipline.md)）。

/** 1 製品分の撤去宣言。パスはリポジトリルート相対。 */
export type ScannerDomain = {
  /** `--only` で指す名前。 */
  key: string;
  /** 人へ見せる名前。 */
  label: string;
  /** commitlint の prefix を含むコミット件名。 */
  commitSubject: string;
  /** これが無ければ撤去済みと見なし、その製品には手を付けない。 */
  presenceMarker: string;
  /** 消すファイルとディレクトリ。 */
  paths: readonly string[];
  /** `.github/egress.yaml` の workflows / audit のキー。 */
  egressJobs: readonly string[];
  /** 撤去後に参照が 0 件になったときだけ消す pin。`owner/repo` で書く。 */
  pinActions: readonly string[];
  /** 撤去後に名前が残っていないかを見る文書。報告するだけで、書き換えない。 */
  docMentions: readonly string[];
  /** 文書の中でこの製品を指す綴り。 */
  mentionPatterns: readonly string[];
};

/** 製品名を載せている文書。撤去後に読み手が掃く先として報告する。 */
const DOCS: readonly string[] = [
  ".github/workflows/README.md",
  "SECURITY.md",
  "docs/adr/0110-security-operations.md",
  "docs/adr/0153-ci-configuration.md",
  "docs/adr/README.md",
  "docs/adr/BACKLOG.md",
  "docs/get-started/setup-repository.md",
];

export const SCANNER_DOMAINS: readonly ScannerDomain[] = [
  {
    key: "sonarcloud",
    label: "SonarQube Cloud",
    commitSubject: "CI: SonarQube Cloud の検査を撤去する",
    presenceMarker: ".github/workflows/sonarcloud.yaml",
    paths: [".github/workflows/sonarcloud.yaml", "sonar-project.properties", "scripts/sonarcloud"],
    egressJobs: ["sonarcloud"],
    pinActions: ["SonarSource/sonarqube-scan-action"],
    docMentions: DOCS,
    mentionPatterns: ["SonarQube", "SonarCloud", "sonarcloud", "sonar-project", "SonarSource"],
  },
  {
    key: "codeql",
    label: "CodeQL",
    commitSubject: "CI: CodeQL の検査を撤去する",
    presenceMarker: ".github/workflows/codeql.yaml",
    paths: [".github/workflows/codeql.yaml", ".github/codeql"],
    egressJobs: ["codeql"],
    // `github/codeql-action` は残る 4 つの workflow が `upload-sarif` で使い続けるため、
    // 宣言はしても参照が 0 件にならず落ちない。数えて決めるので、ここに書いても安全である。
    pinActions: ["github/codeql-action"],
    docMentions: DOCS,
    mentionPatterns: ["CodeQL", "codeql"],
  },
  {
    key: "dependency-review",
    label: "Dependency Review",
    commitSubject: "CI: Dependency Review の検査を撤去する",
    presenceMarker: ".github/workflows/dependency-review.yaml",
    paths: [".github/workflows/dependency-review.yaml"],
    egressJobs: ["dependency-review"],
    pinActions: ["actions/dependency-review-action"],
    docMentions: DOCS,
    mentionPatterns: ["Dependency Review", "dependency-review"],
  },
];

// 資格情報を要するスキャナ 1 製品分の撤去宣言。ここはデータだけを持ち、撤去の手順は入口
// ([index.ts](index.ts))が担う。
//
// **文書は書き換えない。**ゲートが見るもの（ファイル・pin・宛先の宣言）だけを機械で始末し、
// 製品名を残している文書は**一覧として報告する**。複製したリポジトリは ADR も文書も上書きして
// 使う前提なので、表の行を完全一致で切り出す機構を持つと、**動いた行に静かに素通りされる側**
// の危険だけが残る（[0157](../../../docs/adr/0157-inspection-declaration-discipline.md)）。

/** 文書から落とす塊。 */
export type DocBlock = {
  file: string;
  /** 落とす本文。行を落とすなら末尾の改行まで含める。 */
  block: string;
};

/** 文書の中で置き換える語句。 */
export type DocFragment = {
  file: string;
  /** 置き換える前の語句。 */
  fragment: string;
  /** 置き換えた後の語句。空文字なら削除。 */
  replacement: string;
};

/** 文書から落とす節。 */
export type DocSection = {
  file: string;
  /** `### 見出し` の形。見出しの形をしていなければ投げる。 */
  heading: string;
};

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
  /** 文書から落とす塊。完全一致で探す。 */
  docBlocks: readonly DocBlock[];
  /** 文書の中で置き換える語句。完全一致で探す。 */
  docFragments: readonly DocFragment[];
  /** 文書から落とす節。見出しから次の同レベル以上の見出しの直前まで。 */
  docSections: readonly DocSection[];
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
    docBlocks: [
      {
        file: ".github/workflows/README.md",
        block:
          "| SonarQube Cloud Scan | `sonarcloud.yaml` | `preflight` / `sonarcloud` / `report` / `unconfigured-notice` | **外部アカウントを要する唯一の検査。** `SONAR_TOKEN` が無ければ走らず、緑のまま「未設定」を PR へ述べる。外すかはセットアップの 1 段で選ぶ |\n",
      },
      {
        file: ".github/workflows/README.md",
        block:
          "| `sonarcloud` | CI のみ | 解析を実行するのは SonarCloud 側で、手元には結果を読む口しか無い。そもそも `SONAR_TOKEN` を開発者の環境へ配らない |\n",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        block:
          "- **外部解析サービス(SonarQube Cloud)**: 上のどれとも違い、**外部アカウントに依存する**唯一の層。public リポジトリでは無料、private では有料であるため、**契約が無いことを既定として設計する** —— `SONAR_TOKEN` が未設定なら解析ジョブごと降り、**緑のまま「未設定」を PR へ述べる**(コメントの不在は「検査が緑だった」と見分けが付かない)。**required check には登録しない**。第三者のアカウントの有無がマージの条件になってはならない。**剥がしの対象にはしない** —— 残すかどうかは契約の有無を知っている側の判断であり、[`docs/get-started/setup-repository.md`](../get-started/setup-repository.md) の 1 段で選ぶ。`projectKey` / `organization` はリポジトリの識別子なので、設定ではなく**アイデンティティ**として `make setup-replace-repository-reference` が書き換える\n",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        block:
          "| `sonar-project.properties` | ルール 1 件 × パスの組(`sonar.issue.ignore.multicriteria`)。**SonarCloud は hotspot を UI で review する仕組みを持つが、それはリポジトリの外に決定を置く** —— 複製したリポジトリへ同じ判断が渡らないので、リポジトリが持つ抑止はこのファイルに限る |\n",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        block:
          "**SonarQube Cloud はこの様式の例外で、抑止の理由をリポジトリの他の場所へ書かない。** この層は撤去を選べる層であり、選ばれれば `sonar-project.properties` と `.github/workflows/sonarcloud.yaml` は一緒に消える。理由をそれ以外——ソースのコメントや、撤去を生き延びる文書——へ置くと、**指摘した規則ごと消えたあとに理由だけが残り、何の話をしているのか誰にも辿れなくなる**。\n\nこの検査の所見に応じてコードの形を変えるときも同じで、**規則名も「Sonar がこう言った」もコメントに書かない**。残す価値のある制約なら、規則を名指しせずにその場の性質として書けるはずで、書けないならそれは抑止ファイルだけが持つべき理由である。\n\n",
      },
      {
        file: "docs/get-started/setup-repository.md",
        block:
          "| [`sonarcloud.yaml`](../../.github/workflows/sonarcloud.yaml) | SonarQube Cloud のアカウントと `SONAR_TOKEN` |\n",
      },
    ],
    docFragments: [],
    docSections: [{ file: "docs/get-started/setup-repository.md", heading: "### 残す場合" }],
    docMentions: DOCS,
    mentionPatterns: ["SonarQube", "SonarCloud", "sonarcloud", "sonar-project", "SonarSource"],
  },
  {
    key: "dependency-review",
    label: "Dependency Review",
    commitSubject: "CI: Dependency Review の検査を撤去する",
    presenceMarker: ".github/workflows/dependency-review.yaml",
    paths: [".github/workflows/dependency-review.yaml"],
    egressJobs: ["dependency-review"],
    pinActions: ["actions/dependency-review-action"],
    docBlocks: [
      {
        file: ".github/workflows/README.md",
        block:
          "| Dependency Review | `dependency-review.yaml` | `dependency-review` | **この PR が増やした依存**だけを見る。他の依存スキャナが見るのは木の現状で、持ち越しと増分を区別できない。呼ぶ API が無料なのは public のときだけで、private では Code Security のライセンスを要求する。外すかはセットアップの 1 段で選ぶ |\n",
      },
      {
        file: ".github/workflows/README.md",
        block: "| ゲート | `dependency-review` | job の exit code |\n",
      },
      {
        file: "SECURITY.md",
        block: "| **この PR が増やした依存** | Dependency Review | CI（PR の差分だけを見る） |\n",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        block:
          "- **依存差分ゲート(Dependency Review)**: 上の 3 者はいずれも**木の現状**を読むため、以前から抱えている脆弱性とこの変更が持ち込んだものを区別できない。前者は報告専用のゲートが構造的に許容せざるを得ないものであり、**「この PR が増やしたか」だけを問う層**を別に置く。増やした当人は取り消せるので、ここは落として良い。閾値は依存監査ゲートと揃えて `high`。呼ぶ API が無料なのは public のときだけで、private では Code Security のライセンスを要求する —— **これは設定の判断であってコードの判断ではない**ので、層は配り、外すかどうかはセットアップの 1 段で選ぶ\n",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        block: "| **ゲート** | Dependency Review | job 自身の exit code |\n",
      },
      {
        file: "docs/get-started/setup-repository.md",
        block:
          "| [`dependency-review.yaml`](../../.github/workflows/dependency-review.yaml) | Dependency graph の有効化（手順 3）。呼ぶ API が無料なのは public のときだけ |\n",
      },
      {
        file: "docs/get-started/setup-repository.md",
        block:
          "   （**このリポジトリでは `dependency-review` job もこれを読む**ため、無効のままだと「このリポジトリでは使えない」で落ちる。設定を入れるまでコード側では直せない）\n",
      },
    ],
    docFragments: [
      {
        file: "docs/adr/0110-security-operations.md",
        fragment: "依存監査ゲート / 依存差分ゲート / データフロー検査",
        replacement: "依存監査ゲート / データフロー検査",
      },
    ],
    docSections: [],
    docMentions: DOCS,
    mentionPatterns: ["Dependency Review", "dependency-review"],
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
    docBlocks: [
      {
        file: ".github/workflows/README.md",
        block:
          "| CodeQL Scan | `codeql.yaml` | `codeql` | 同じ問いに GitHub 側の解析で答える。high の検出でマージを止めるのは code scanning 側の設定で、この job が落ちるのは解析そのものが走らなかったときだけ |\n",
      },
      {
        file: ".github/workflows/README.md",
        block:
          "`codeql` には掛けていない。code scanning の alert は「後の解析がもう報告しない」ことでしか閉じず、PR ごとに解析を省くと閉じる契機を落としうる。**GitHub 側の仕組みに judgement を預けている検査なので、こちらの都合で走行回数を減らさない。**\n\n",
      },
      {
        file: "SECURITY.md",
        block: "| 自分が書いたコード | CodeQL | CI。GitHub の中でだけ走る層 |\n",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        block:
          "- **CodeQL SAST**: `languages: javascript-typescript`。trigger = PR + 保護ブランチ push + 週次 cron。`security-events: write` で SARIF アップロード。high-severity はマージブロック(ブロックの実体は branch protection / code scanning の required 設定側。workflow 内の hard-fail には依存しない)\n",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        block:
          "| CodeQL | **降りない** | code scanning の alert は「後の解析がもう報告しない」ことでしか閉じない。走行回数を減らすと閉じる契機を落としうる |\n",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        block: "- ❌ SAST を CodeQL だけに寄せること(持ち出せない層を唯一の SAST にしない)\n",
      },
      {
        file: "docs/get-started/setup-repository.md",
        block:
          "| [`codeql.yaml`](../../.github/workflows/codeql.yaml) | GitHub Advanced Security。public は無料、private は課金 |\n",
      },
      {
        file: ".github/workflows/README.md",
        block: "| code scanning へ送る | `codeql` / `sonarcloud` | 同上 |\n",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        block: "| **code scanning へ送る** | CodeQL / SonarQube Cloud | 同上 |\n",
      },
    ],
    docFragments: [
      {
        file: "docs/adr/0110-security-operations.md",
        fragment: "・CodeQL・Opengrep)",
        replacement: "・Opengrep)",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        fragment: "上の 2 つと同じ問いに",
        replacement: "上と同じ問いに",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        fragment: "Opengrep / CodeQL が引き続き担う",
        replacement: "Opengrep が引き続き担う",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        fragment:
          "Opengrep も CodeQL も自分が構文解析できる言語しか開かないので、**どちらも開かないファイル**",
        replacement:
          "Opengrep は自分が構文解析できる言語しか開かないので、**それが開かないファイル**",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        fragment: "Trivy / CodeQL のマージブロック",
        replacement: "Trivy のマージブロック",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        fragment: "/ CodeQL・gitleaks は fail-closed)",
        replacement: "/ gitleaks は fail-closed)",
      },
      {
        file: "docs/adr/0110-security-operations.md",
        fragment:
          "- ❌ gitleaks / CodeQL の検出を fail-closed にしないこと(秘密・SAST high は必ずブロック)",
        replacement: "- ❌ gitleaks の検出を fail-closed にしないこと(秘密は必ずブロック)",
      },
      {
        file: ".github/workflows/README.md",
        fragment:
          "**この層の鮮度は CodeQL が補っている**（GitHub 側が更新し続ける）ため、SAST 全体が固まるわけではない。",
        replacement: "この層だけで鮮度は保てないので、規則の更新は上流の fork の動きに従う。",
      },
      {
        file: "docs/adr/README.md",
        fragment: "Trivy 二段 / CodeQL / image-scan",
        replacement: "Trivy 二段 / Opengrep / image-scan",
      },
      {
        file: "docs/adr/0153-ci-configuration.md",
        fragment: "Security グループ(CodeQL / Trivy",
        replacement: "Security グループ(Opengrep / Trivy",
      },
      {
        file: "docs/adr/BACKLOG.md",
        fragment: "Trivy 二段・CodeQL js-ts /",
        replacement: "Trivy 二段・Opengrep /",
      },
      {
        file: "docs/adr/BACKLOG.md",
        fragment: "CI 側は `codeql` / `gitleaks`",
        replacement: "CI 側は `gitleaks`",
      },
    ],
    docSections: [],
    docMentions: DOCS,
    mentionPatterns: ["CodeQL", "codeql"],
  },
];

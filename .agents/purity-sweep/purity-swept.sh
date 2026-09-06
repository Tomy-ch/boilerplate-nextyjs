#!/usr/bin/env sh
# そのファイルが純化パスを通ったかどうかを、purity-swept.toml に照らして答える。
#
# 2 つのモードを持つ。引数にパスを渡すと 1 行 1 判定を出す。`--hook` を渡すと Claude Code /
# Codex の PreToolUse ペイロードを標準入力から読み、additionalContext を返す。
#
# 常に exit 0 で終わる。判定はこれから編集する者への助言であり、フック経路で非ゼロを返すと
# 助言が編集の拒否に変わる。1 行の修正が常にファイル全体の純化を引き連れるようになり、
# 作業中に断れなくなる。

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
LEDGER="${SCRIPT_DIR}/purity-swept.toml"
REPO_ROOT=$(CDPATH='' cd -- "${SCRIPT_DIR}/../.." && pwd)
PROMPT_REL=".agents/purity-sweep/purity-sweep.prompt"

# REPO_ROOT が worktree と共有するオブジェクトストア。あるパスがこのリポジトリのものかを
# 判定する唯一の手段でもある。git が答えられないときは空になり、認識できる範囲が
# REPO_ROOT 配下だけに狭まる。
REPO_COMMON=$(git -C "${REPO_ROOT}" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || :)

CLEAR='対応不要'
PENDING='純化は保留中'
REQUIRED='純化パスが要る'

usage() {
  cat <<'USAGE'
使い方:
  purity-swept.sh <path>...   パスごとに判定を出す
  purity-swept.sh --remaining 走査対象のうち、まだ記帳されていないパスを並べる
  purity-swept.sh --pending   還元先が無くて止まっているパスを、理由付きで並べる
  purity-swept.sh --stat      走査対象・記帳済み・保留・残量の数を出す
  purity-swept.sh --hook      PreToolUse ペイロードを標準入力から読み、フック JSON を出す

判定:
  対応不要        台帳の [swept] に在るか、純化する在庫を持たない。括弧がどちらかを述べる。
  純化は保留中    走査は済んでいるが、還元先が無くて止まっている。括弧がその理由を述べる。
  純化パスが要る  同じディレクトリの purity-sweep.prompt を読み、そのとおりにする。
USAGE
}

# 絶対パスを保持する作業ツリー。REPO_ROOT 自身か、その worktree のどれか。worktree は
# REPO_ROOT の配下ではなく隣に居るため、接頭辞の比較だけでは足りない。別のリポジトリに
# 属するパス・どこにも属さないパスでは空を返し、そのパスは相対化されないまま残る。
checkout_root() {
  [ -n "${REPO_COMMON}" ] || return 0

  # これから作られるパスにはまだディレクトリが無い。存在する最も近い祖先が代わりに答える。
  dir=$(dirname -- "$1")
  while [ ! -d "${dir}" ]; do
    parent=$(dirname -- "${dir}")
    [ "${parent}" != "${dir}" ] || return 0
    dir=${parent}
  done

  info=$(git -C "${dir}" rev-parse --path-format=absolute --show-toplevel --git-common-dir 2>/dev/null) || return 0
  [ "$(printf '%s\n' "${info}" | sed -n 2p)" = "${REPO_COMMON}" ] || return 0
  printf '%s\n' "${info}" | sed -n 1p | tr -d '\n'
}

# リポジトリ相対へ揃える。フックから来る絶対パスと、シェルから来る相対パスが、どちらの
# 作業ツリーに在っても同じエントリへ届く。リポジトリの外のパスはそのまま残し、単に台帳を
# 外す。
to_relative() {
  case "$1" in
    "${REPO_ROOT}/"*) printf '%s' "${1#"${REPO_ROOT}"/}" ;;
    /*)
      root=$(checkout_root "$1")
      if [ -n "${root}" ] && [ "$1" != "${1#"${root}"/}" ]; then
        printf '%s' "${1#"${root}"/}"
      else
        printf '%s' "$1"
      fi
      ;;
    ./*) printf '%s' "${1#./}" ;;
    *) printf '%s' "$1" ;;
  esac
}

# そのパスがディスク上のどこに在るか。worktree のファイルは REPO_ROOT の配下ではない。
# 相対パスはリポジトリ相対として扱い、to_relative と対を成す。
on_disk() {
  case "$1" in
    /*) printf '%s' "$1" ;;
    *) printf '%s/%s' "${REPO_ROOT}" "$(to_relative "$1")" ;;
  esac
}

# 走査が届かないもの。生成物は生成器が書き直し、依存の取得物は我々のものではなく、
# リリースノートは全体が変更履歴そのもので、純化が消す対象しか書かれていない。資材は
# 読む文が無い。存在しないパスは、これから作られるファイルであって在庫を持たない。
# リポジトリ相対のパスと、同じファイルのディスク上の位置を受け取る。理由を出し、
# 走査対象なら空を出す。
out_of_scope_reason() {
  case "$1" in
    # パスが絶対のまま残るのは to_relative が相対化を諦めたときだけで、それはこの
    # リポジトリのどの作業ツリーにも属さないことを意味する。台帳はそのファイルについて
    # 何も述べない。
    /*)
      printf 'リポジトリの外'
      return
      ;;
    node_modules/* | */node_modules/*)
      printf '依存の取得物'
      return
      ;;
    */generated/* | *.gen.ts | *.gen.yaml | *.gen.css)
      printf '生成物'
      return
      ;;
    .next/* | coverage/* | coverage-scripts/* | dist/* | storybook-static/* | graphify-out/* | blob-report/* | docs/portal/guides/* | docs/portal/docs.json)
      printf '生成物'
      return
      ;;
    .github/release/*)
      printf 'リリースの記録'
      return
      ;;
    pnpm-lock.yaml | *.lock | *lock.json | *lock.yaml | *-pin.toml)
      printf 'ロックファイル'
      return
      ;;
    baseline/images | baseline/images/*)
      printf '別リポジトリ（submodule）'
      return
      ;;
    tmp/*)
      printf '作業用スクラッチ'
      return
      ;;
    *.png | *.jpg | *.jpeg | *.gif | *.ico | *.webp | *.avif | *.svg | *.woff | *.woff2 | *.ttf | *.otf)
      printf '資材'
      return
      ;;
  esac

  [ -f "$2" ] || printf 'ファイルが存在しない'
}

# 台帳の引きは TOML のパースではなく、表の見出しを追いながらの行頭一致で行う。依存を
# 増やさないためである。すべての鍵が引用符付きで書かれることに乗っており、それは台帳の
# 冒頭がスキーマとして宣言している。出力は `<表>\t<値>`、どちらの表にも無ければ空。
lookup() {
  awk -v key="$1" '
    /^\[[a-z]+\]$/ { table = substr($0, 2, length($0) - 2); next }
    index($0, "\"" key "\" = ") == 1 {
      value = substr($0, index($0, " = ") + 3)
      gsub(/^"|"[[:space:]]*$/, "", value)
      print table "\t" value
      exit
    }
  ' "${LEDGER}"
}

# 片方の表の鍵だけを並べる。1 ファイルずつ lookup を呼ぶと台帳を鍵の数だけ読み直すので、
# 残量を数える経路はこちらを 1 度だけ引く。
list_keys() {
  awk -v want="$1" '
    /^\[[a-z]+\]$/ { table = substr($0, 2, length($0) - 2); next }
    table == want && index($0, "\"") == 1 {
      print substr($0, 2, index(substr($0, 2), "\"") - 1)
    }
  ' "${LEDGER}"
}

# 走査対象。追跡されているファイルから、在庫を持たないものを落とす。追跡されていないものは
# リポジトリが配るものではないので数えない。
list_targets() {
  git -C "${REPO_ROOT}" ls-files | while IFS= read -r rel; do
    [ -n "$(out_of_scope_reason "${rel}" "${REPO_ROOT}/${rel}")" ] || printf '%s\n' "${rel}"
  done
}

# 走査対象のうち、どちらの表にも載っていないもの。
list_remaining() {
  listed=$(mktemp)
  { list_keys swept; list_keys pending; } >"${listed}"
  list_targets | grep -vxF -f "${listed}" || :
  rm -f "${listed}"
}

verdict() {
  rel=$(to_relative "$1")
  reason=$(out_of_scope_reason "${rel}" "$(on_disk "$1")")

  if [ -n "${reason}" ]; then
    printf '%s（%s）' "${CLEAR}" "${reason}"
    return
  fi

  entry=$(lookup "${rel}")
  case "${entry}" in
    swept*) printf '%s（台帳に在る）' "${CLEAR}" ;;
    pending*) printf '%s（%s）' "${PENDING}" "${entry#*	}" ;;
    *) printf '%s' "${REQUIRED}" ;;
  esac
}

# ペイロードから編集対象のパスを取り出す。JSON の解釈は node が担う。node は mise.toml が
# 固定しており、このリポジトリで作業している限り必ず居る。
extract_paths() {
  node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      const input = payload?.tool_input ?? {};
      const found = [];
      for (const key of ["file_path", "notebook_path"]) {
        if (typeof input[key] === "string" && input[key] !== "") found.push(input[key]);
      }
      // Codex の apply_patch は 1 つのコマンド文字列に複数のファイルを載せる。
      if (typeof input.command === "string") {
        for (const line of input.command.split("\n")) {
          const match = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/.exec(line);
          if (match !== null) found.push(match[1]);
        }
      }
      process.stdout.write(found.join("\n"));
    });
  '
}

# additionalContext の封筒。パスと文面は argv で渡し、JSON の逃がしは node に任せる。
emit_hook_json() {
  node -e '
    const [context] = process.argv.slice(1);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: context },
    }));
  ' "$1"
}

run_hook() {
  # node が無ければペイロードを読む手立てが無い。黙って落ちるのが正しい失敗で、
  # そうしない場合の代案は、編集のたびにエラー通知を出すことである。
  command -v node >/dev/null 2>&1 || exit 0

  payload=$(cat) || exit 0
  paths=$(printf '%s' "${payload}" | extract_paths) || exit 0
  [ -n "${paths}" ] || exit 0

  required=''
  pending=''
  while IFS= read -r path; do
    [ -n "${path}" ] || continue
    rel=$(to_relative "${path}")
    [ -z "$(out_of_scope_reason "${rel}" "$(on_disk "${path}")")" ] || continue
    entry=$(lookup "${rel}")
    case "${entry}" in
      swept*) continue ;;
      pending*) pending="${pending}${pending:+, }${rel}（${entry#*	}）" ;;
      *) required="${required}${required:+, }${rel}" ;;
    esac
  done <<EOF
${paths}
EOF

  context=''
  if [ -n "${required}" ]; then
    context="${required}: まだ純化パスを通っていない。編集を済ませたら、タスクを終える前に ${PROMPT_REL} を読み、そのとおりにすること。"
  fi
  if [ -n "${pending}" ]; then
    context="${context}${context:+ }${pending}: 走査は済んでいるが還元先が無くて止まっている。触るなら、その保留を今片付けられるかを見ること。"
  fi
  [ -n "${context}" ] || exit 0

  # 意図してポインタであって、手順そのものではない。これは未走査のファイルを編集する
  # たびに出るので、その費用は純化が起きるかどうかに関わらず払われる。裏に居る prompt は
  # 一度だけ、実行に移すときにだけ読まれる。
  emit_hook_json "${context}"
}

if [ ! -f "${LEDGER}" ]; then
  echo "台帳が見つからない: ${LEDGER}" >&2
  exit 0
fi

case "${1:-}" in
  --hook)
    run_hook
    ;;
  --remaining)
    list_remaining
    ;;
  --pending)
    awk '
      /^\[[a-z]+\]$/ { table = substr($0, 2, length($0) - 2); next }
      table == "pending" && index($0, "\"") == 1 { print }
    ' "${LEDGER}"
    ;;
  --stat)
    targets=$(list_targets | wc -l | tr -d ' ')
    swept=$(list_keys swept | wc -l | tr -d ' ')
    pending=$(list_keys pending | wc -l | tr -d ' ')
    remaining=$(list_remaining | wc -l | tr -d ' ')
    printf '走査対象 %s / 記帳済み %s / 保留 %s / 残量 %s\n' \
      "${targets}" "${swept}" "${pending}" "${remaining}"
    ;;
  -h | --help | '')
    usage
    ;;
  *)
    for target in "$@"; do
      printf '%s\t%s\n' "$(verdict "${target}")" "$(to_relative "${target}")"
    done
    ;;
esac

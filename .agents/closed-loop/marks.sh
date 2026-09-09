#!/usr/bin/env sh
# 作業の窓の段の境界を打刻し、各段が実際にどれだけ掛かったかを後から言えるようにする。
#
# 段の境界は、それを越えたワークフロー以外のどこにも存在しない。だから越えた側がここで刻む。
#
# 単位はセッションではなく**窓**なので、打刻は checkout ごとではなく窓ごとに綴じる。何が窓を開き
# 何が閉じるかは下の ROTATING_SOURCES が持つ。なぜ打刻なのか、なぜ窓なのかは [README](../README.md)。
#
# 打刻はすべて**イベントの列**である。1 つの名前に 1 ファイル、1 行 1 epoch、常に追記
# （読む側がどう取るかは [README](../README.md)）。この形を選んだ理由は 2 つ。
#
#   ファイルを分ける    打刻は複数のプロセスから追記される。git の hook はセッションの途中で
#                       発火し、2 つのセッションが 1 つの checkout を共有することもある。
#                       1 つのファイルへ追記すると書き込みが交錯する。分ければ衝突しない。
#                       守られるのは**打刻だけ**で、現在の窓を指すポインタは共有の 1 ファイルなので
#                       下のロックが要る。
#   1 行 1 epoch        解析せずに比較でき、どの言語からも読め、取り違える timezone が無い。
#
# 打刻は checkout の追跡外 `tmp/` に住む（[README](../README.md)）。
#
# **名前の集合は閉じている。**知らない名前は、黙ってファイルを作らずに拒む。防いでいる失敗は
# 「打ち間違いが、誰も読まない打刻になる」こと —— なぜその段にデータが無いのかと誰かが問うまで
# 見えない。
#
# hook として呼ばれたときは常に exit 0 で終わる。**これが答えられるかどうかに関わらず、窓は開く。**

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH='' cd -- "${SCRIPT_DIR}/../.." && pwd)
LOOP_DIR="${REPO_ROOT}/tmp/closed-loop"
CURRENT_FILE="${LOOP_DIR}/current"

# ループが報告する段。ここへ足すことが、書けるようにすることである。
KNOWN_MARKS='openedAt planApprovedAt implStartedAt commitAt reviewStartedAt prOpenedAt mergedAt closedAt'

# 窓を終わらせるのは、人が「それは終わった」と言うこと —— 文脈の明示的な破棄、あるいは人が
# 自分で打った圧縮。`startup` と `resume` は既に開いているものを続ける。**`compact` をここへ足さない**
# —— SessionStart は自動の圧縮と手動の圧縮を区別せずに報告し、境界なのは手動のほうだけである。
# だから手動側は、`trigger` を持つ PreCompact で捕まえる。
ROTATING_SOURCES='clear'

# 現在の窓を指すポインタは共有の 1 ファイルなので、打刻のファイル分けによる安全はここまで及ばない。
# ローテーションは複数のコマンドに跨る read-modify-write で、2 つのプロセスが同時に行うと窓が
# 1 つ孤児になる。
#
# ロックに `mkdir` を使うのは、どの POSIX ファイルシステムでも原子的で、macOS が持たない `flock` を
# 要らないため。停止したプロセスが残したロックは以後の実行をすべて詰まらせるので、待ちは有限にして
# 諦める —— ローテーションを 1 回落とすとデータが劣化するだけだが、hook が固まると作業が止まる。
LOCK_DIR="${LOOP_DIR}/.rotate.lock"
LOCK_HELD=0

acquire_lock() {
  attempt=0
  while [ "${attempt}" -lt 50 ]; do
    if mkdir "${LOCK_DIR}" 2>/dev/null; then
      LOCK_HELD=1
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 0.1
  done
  return 1
}

release_lock() {
  [ "${LOCK_HELD}" -eq 1 ] || return 0
  rmdir "${LOCK_DIR}" 2>/dev/null || :
  LOCK_HELD=0
}

trap release_lock EXIT INT TERM

usage() {
  cat <<'USAGE'
使い方:
  marks.sh <name>     現在の窓に <name> を打刻する
  marks.sh --list     現在の窓の打刻を `<name> <epoch>` の行で出す
  marks.sh --window   現在の窓の id を出す（無ければ開く）
  marks.sh --names    書ける打刻の名前を出す
  marks.sh --hook <event>
                      hook から呼ばれる。<event> は次のいずれか:
                        session-start  `source` が窓を終わらせるものなら回す。でなければ続ける
                        pre-compact    `trigger` が手動なら回す。でなければ続ける
                        session-end    現在の窓を閉じる

打刻は、この checkout の tmp/closed-loop/marks/<window-id>/ に書かれる。
USAGE
}

is_known() {
  for known in ${KNOWN_MARKS}; do
    [ "$1" = "${known}" ] && return 0
  done
  return 1
}

# 同じ秒に開いた 2 つの窓が衝突しない程度の乱雑さ。uuid のバイナリが入っていることに依存しない。
new_window_id() {
  suffix=$(od -An -N4 -tx1 /dev/urandom 2>/dev/null | tr -d ' \n') || suffix=""
  [ -n "${suffix}" ] || suffix=$$
  printf 'w%s-%s' "$(date +%s)" "${suffix}"
}

open_window() {
  mkdir -p "${LOOP_DIR}"
  acquire_lock || {
    # ロックを取れなければ、既に別プロセスがローテーションしている。そちらの結果に従うのが
    # 正しく、ここで重ねて開くと窓が二重になる。
    current_window_unsafe
    return 0
  }
  close_window
  id=$(new_window_id)
  mkdir -p "${LOOP_DIR}/marks/${id}"
  date +%s >>"${LOOP_DIR}/marks/${id}/openedAt"
  # ポインタは最後に、一時ファイル経由で差し替える。窓の中身が揃う前にポインタだけが
  # 新窓を指す瞬間を作らないため。同一ディレクトリ内の mv は原子的に置き換わる。
  printf '%s\n' "${id}" >"${CURRENT_FILE}.tmp.$$"
  mv "${CURRENT_FILE}.tmp.$$" "${CURRENT_FILE}"
  release_lock
  printf '%s' "${id}"
}

# 出ていく窓に打刻することが、窓を閉区間にする。これが無いと、どの窓も最後の段が無限へ伸び、
# その段の所要時間を計算できない。
close_window() {
  id=$(current_window_unsafe) || return 0
  dir="${LOOP_DIR}/marks/${id}"
  [ -d "${dir}" ] || return 0
  [ -f "${dir}/closedAt" ] || date +%s >>"${dir}/closedAt"
}

# 現在の窓を読むだけで、無ければ開かない。診断や一覧のように「見るだけ」の経路が窓を作ってしまうと、
# 誰も打刻しない空の窓がレポートに残り続ける。
current_window_unsafe() {
  [ -f "${CURRENT_FILE}" ] || return 1
  id=$(cat "${CURRENT_FILE}")
  [ -n "${id}" ] || return 1
  printf '%s' "${id}"
}

current_window() {
  current_window_unsafe && return 0
  open_window
}

# 窓 ID を引数で受け取る。呼び出し側が 1 度だけ読んだ ID に対して判定と書き込みの両方を行える
# ようにするため。読み直すと、その間にローテーションが割り込んだとき、判定した窓と書き込む窓が
# 食い違う。
is_window_closed() {
  [ -n "${1:-}" ] || return 1
  [ -f "${LOOP_DIR}/marks/$1/closedAt" ]
}

# 窓が閉じた後に届いた作業は、次の窓のものであって最後の窓のものではない。セッションが終わった
# 後に着地したコミットは、終わったものへの遅れた脚注ではなく**何かの始まり**である —— そして
# 閉じた窓へ綴じると、その窓自身の終わりより後ろに打刻が並び、どんな区間も計算できなくなる。
#
# 終端の 2 つは、逆の理由で例外である。既に閉じた窓への `closedAt` は同じ事実の二度目であり、
# `openedAt` は開くこと自体が打刻するので、回してから打刻すると開きを二重に記録する。
stamp_mark() {
  name=$1
  id=$(current_window)
  if is_window_closed "${id}"; then
    case "${name}" in
      closedAt) return 0 ;;
      openedAt)
        open_window >/dev/null
        return 0
        ;;
      *) id=$(open_window) ;;
    esac
  fi
  dir="${LOOP_DIR}/marks/${id}"
  mkdir -p "${dir}"
  date +%s >>"${dir}/${name}"
}

case "${1:-}" in
  -h | --help)
    usage
    ;;
  --names)
    for known in ${KNOWN_MARKS}; do printf '%s\n' "${known}"; done
    ;;
  --window)
    current_window
    printf '\n'
    ;;
  --list)
    id=$(current_window_unsafe) || exit 0
    dir="${LOOP_DIR}/marks/${id}"
    [ -d "${dir}" ] || exit 0
    for known in ${KNOWN_MARKS}; do
      file="${dir}/${known}"
      [ -f "${file}" ] || continue
      while IFS= read -r epoch; do
        [ -n "${epoch}" ] && printf '%s %s\n' "${known}" "${epoch}"
      done <"${file}"
    done
    ;;
  --hook)
    # ペイロードは標準入力から届く。それを読むことが hook を失敗させられてはならないので、
    # どの段も「現在の窓を続ける」へ degrade する —— 回し損ねると 2 つの窓が 1 つに混ざるだけだが、
    # 誤って回すと、まだ開いていた窓が壊れる。保守的なのは前者である。
    field=""
    case "${2:-}" in
      session-start) field='.source' ;;
      pre-compact) field='.trigger' ;;
      session-end)
        close_window
        exit 0
        ;;
      *) exit 0 ;;
    esac

    value=""
    if command -v jq >/dev/null 2>&1; then
      payload=$(cat 2>/dev/null) || payload=""
      [ -n "${payload}" ] && value=$(printf '%s' "${payload}" | jq -r "${field} // empty" 2>/dev/null || printf '')
    fi

    rotate=0
    case "${2}" in
      session-start)
        for ending in ${ROTATING_SOURCES}; do
          [ "${value}" = "${ending}" ] && rotate=1
        done
        ;;
      pre-compact)
        [ "${value}" = "manual" ] && rotate=1
        ;;
      *)
        # 知らないフックからは窓を回さない。開くべきかどうかを判断できない以上、回さないほうが
        # 安全（回し損ねた作業は次の打刻で拾えるが、誤って回すと 1 つの作業が 2 窓に割れて
        # 元に戻せない）。
        ;;
    esac

    if [ "${rotate}" -eq 1 ] || { [ "${2}" = "session-start" ] && [ ! -f "${CURRENT_FILE}" ]; }; then
      open_window >/dev/null
    fi
    exit 0
    ;;
  '')
    usage >&2
    exit 2
    ;;
  *)
    if is_known "$1"; then
      stamp_mark "$1"
    else
      printf '知らない打刻です: %s\n' "$1" >&2
      printf '書ける名前: %s\n' "${KNOWN_MARKS}" >&2
      exit 2
    fi
    ;;
esac

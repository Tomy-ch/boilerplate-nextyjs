#!/usr/bin/env sh
# 閉じたまま issue へ届いていない窓を送出する。
#
# 打刻するのはここではなく marks.sh、何を送るかを決めるのは scripts/closed-loop/send である。
# ここが持つのは**起動の作法**だけ —— セッションを止めないことと、二重に走らないことの 2 つ。
#
# SessionEnd ではなく SessionStart で回す。閉じた窓は完成しているのでいつ送ってもよいが、
# 終わろうとしているセッションは人が「もう消えてほしい」と思っている唯一の瞬間で、そこでの
# 通信は誰も見ていない場所で固まる。送れなかった窓は索引に載らないまま残り、次の開始が拾う ——
# `/clear` は窓を閉じると同時に SessionStart を起こすので、実際には境界のたびにほぼ即座に送られる。
#
# **すべての経路が「何もしない」へ縮退する。**pnpm が無い、gh が未認証、ネットワークが無い ——
# どれも索引を触らずに終わり、窓は次回へ持ち越される。セッションを落としてはならないので、
# 常に 0 で抜け、実際の送出は背後で回す。

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH='' cd -- "${SCRIPT_DIR}/../.." && pwd)
ENTRY="scripts/closed-loop/send"
LOCK_DIR="${REPO_ROOT}/tmp/closed-loop/send.lock"

# 索引は read-modify-write なので、2 つ走ると両方が同じ窓を未送出と見て、同じ窓に 2 つ issue を
# 立てる。marks.sh のポインタと同じ理由で `mkdir` を使う —— どの POSIX ファイルシステムでも
# 原子的で、macOS が持たない `flock` を要らない。
#
# **解放を trap だけに任せない。**`--hook` は `( ... & )` の二重の背景で起動し、その形では EXIT
# の trap が走らない。ここでの取り残しは永久で、しかも静かである —— 以後の実行はすべて
# ディレクトリを見つけて、何も送らずに帰る。
#
# だから古いロックは信用せず奪う。どんな送出より長く握っているものは、何があったにせよもう
# 走っていない。向きはこれで正しい: 送出を 1 回落としても次の開始が拾うが、取り残されたロックは
# そのすべてを止めて何も言わない。
#
# 既に走っているときは待たない。待ち行列は、詰まってはならない呼び出しの後ろへ同じ仕事の
# 二重を積み上げるだけである。
LOCK_STALE_SEC=1800

# `stat` の旗は BSD と GNU で違うので `find -mmin` を使う。
lock_is_stale() {
  [ -d "${LOCK_DIR}" ] || return 1
  [ -n "$(find "${LOCK_DIR}" -maxdepth 0 -mmin "+$((LOCK_STALE_SEC / 60))" 2>/dev/null)" ]
}

acquire_lock() {
  mkdir -p "$(dirname -- "${LOCK_DIR}")" 2>/dev/null || return 1
  mkdir "${LOCK_DIR}" 2>/dev/null && return 0
  lock_is_stale || return 1
  rmdir "${LOCK_DIR}" 2>/dev/null || return 1
  mkdir "${LOCK_DIR}" 2>/dev/null
}

release_lock() {
  rmdir "${LOCK_DIR}" 2>/dev/null || :
}

run() {
  (cd "${REPO_ROOT}" && pnpm exec tsx "${ENTRY}" "$@")
}

# ロックを掛けるのは実際に送る経路だけ。`--dry-run` は索引を触らないので、送出が走っている
# 最中でも見られてよい。
locked_run() {
  acquire_lock || return 0
  trap 'release_lock' INT TERM
  # `set -e` の下では run が落ちると以降が走らないため、`if` で終了コードを受けてから解放する。
  # 失敗しても握ったままにしないのが、ここの要件である。
  if run; then status=0; else status=$?; fi
  release_lock
  return "${status}"
}

usage() {
  cat <<'USAGE'
使い方:
  send.sh            閉じたまま未送出の窓を送る（前景。結果を出す）
  send.sh --hook     同じことを、切り離して静かに行う（SessionStart）
  send.sh --dry-run  何を送るかだけ出す。何も送らない

pnpm と認証済みの gh が要る。無いことは失敗ではない —— 窓は未送出のまま残り、次回が拾う。
USAGE
}

case "${1:-}" in
  -h | --help)
    usage
    ;;
  --hook)
    # 切り離す: SessionStart はネットワークを待ってはならない。失敗が見えないのは意図どおりで、
    # 索引に載らなかった窓を次の開始が拾う。
    command -v pnpm >/dev/null 2>&1 || exit 0
    command -v gh >/dev/null 2>&1 || exit 0
    (locked_run >/dev/null 2>&1 &) || :
    exit 0
    ;;
  --dry-run)
    run --dry-run
    ;;
  '')
    locked_run
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

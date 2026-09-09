# base-merge

ベースブランチをいまのブランチへ取り込み、未解決のパスを並べる。`make base-merge` の実体。

解決そのものは持たない。衝突したパスをどのクラスとして裁くか（生成物なら再生成、pin lockfile なら
resolver の再実行、追記専用のレジストリなら和集合）は `resolve-merge` スキルの判断で、この道具は
**取り込みと報告まで**を持つ。分類表をここへ置くと、表が 2 か所に住む。

## ベースは PR の `baseRefName` が最も強い

順に、最初に決まったものを採る。

1. `--base=<ref>` —— 人が明示したもの
2. `gh pr view --json baseRefName` —— **PR がある枝ではこれが正**。その枝がいま実際にマージしていく先だから
3. origin の最新のリリースライン —— PR が無いときだけ。判定は
   [`../base-branch/resolve.ts`](../base-branch/resolve.ts) と共有する

**`refs/remotes/origin/HEAD` と `gh repo view --json defaultBranchRef` は読まない。**どちらも警告を出さずに
前のリリースラインを答え、その結果 diff が 1 世代ぶん黙って広がる。理由の詳細は
[`../base-branch/README.md`](../base-branch/README.md) が持つ。

PR がある枝でそのベース以外を取り込むと、追いつかせるつもりが**行き先の付け替え**になる。新しい
リリースラインが開いていても、その枝が向かう先は PR が決めている。

**hotfix ラインが絡むときは推測しない。**最新のリリースラインの解決は `release/*` しか見ないので
hotfix を名指さない。`--base=<ref>` を人から受け取る。

## rebase しない

[0150](../../docs/adr/0150-git-workflow.md) の規約であることに加えて、追記専用のファイル
（レジストリの表、目録）では rebase が実害を出す —— 同じ内容が別のハッシュで再着地し、2 つの独立した
追加として読める。

## 拒む 2 つの状態

- **保護ブランチの上**（`production` / `staging` / `develop` / `release/**` / `hotfix/**`）——
  取り込んだ後の push が 0150 の「保護ブランチへ直接 push しない」に当たる。マージしてから気付くと、
  作業ツリーが MERGING のまま行き場を失う
- **作業ツリーが汚れている** —— 衝突の解決と手元の未確定変更が同じツリーに混ざり、どちらが衝突由来かを
  後から見分けられなくなる

## 終わり方

| 状態 | 終了コード | 出力 |
| --- | --- | --- |
| 取り込めた | 0 | stderr に取り込んだベース |
| 衝突が残った | 1 | **stdout に未解決のパスを 1 行 1 件**、stderr に件数 |

衝突が残っても**作業ツリーは MERGING のまま残す。**解決は `resolve-merge` が続けるので、ここで
`git merge --abort` を打つと、その入力ごと捨てることになる。

stdout をパスだけにしてあるのは `$(make -s base-merge)` で受けられるようにするため。案内はすべて
stderr へ出す（[`../base-branch`](../base-branch/README.md) と同じ扱い）。

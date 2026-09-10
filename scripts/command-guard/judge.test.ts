import { describe, expect, it } from "vitest";

import { deriveLiterals, judge, parseShape, stripQuoted, unwrap } from "./judge.ts";

const DENY = [
  "Bash(make tag-patch *)",
  "Bash(make setup-repo *)",
  "Bash(rm -rf *)",
  "Bash(git push --force*)",
  "Bash(git switch -f *)",
  "Bash(git branch -d *)",
  "Bash(git branch -D *)",
  "Bash(rtk init *)",
  "Edit(AGENTS.md)",
];
const LITERALS = deriveLiterals(DENY);

describe("deriveLiterals", () => {
  // ----- 正常系 -----
  it("`Bash(...)` から `*` の手前までを綴りとして取り出す", () => {
    expect(deriveLiterals(["Bash(make tag-patch *)", "Bash(graphify install*)"])).toEqual([
      "graphify install",
      "make tag-patch",
    ]);
  });

  it("重複した綴りを 1 つに畳む", () => {
    expect(deriveLiterals(["Bash(rm -rf *)", "Bash(rm -rf)"])).toEqual(["rm -rf"]);
  });

  // ----- 異常系 -----
  it("Bash 以外の宣言を落とす", () => {
    expect(deriveLiterals(["Edit(AGENTS.md)", "Write(LICENSE)"])).toEqual([]);
  });

  it("綴りが空になる宣言を落とす", () => {
    expect(deriveLiterals(["Bash(*)"])).toEqual([]);
  });
});

describe("parseShape", () => {
  // ----- 正常系 -----
  it("flag が現れる前までを先頭の語とする", () => {
    expect(parseShape("git switch -f").head).toBe("git switch");
  });

  it("束ねた短 flag を 1 文字ずつに解く", () => {
    expect([...parseShape("rm -rvf").shortFlags].sort()).toEqual(["f", "r", "v"]);
  });

  it("離して書いた短 flag を同じ集合にする", () => {
    expect([...parseShape("rm -r -f").shortFlags].sort()).toEqual(
      [...parseShape("rm -fr").shortFlags].sort(),
    );
  });

  it("長 flag を集合へ崩さず綴りのまま持つ", () => {
    expect(parseShape("git push --force-with-lease").longFlags).toEqual(["--force-with-lease"]);
  });

  // ----- 異常系 -----
  it("flag より後ろの語を先頭の語に混ぜない", () => {
    expect(parseShape("rm -rf dist").head).toBe("rm");
  });
});

describe("unwrap", () => {
  // ----- 正常系 -----
  it("`make ai-<target>` を `make <target>` へ均す", () => {
    expect(unwrap("make ai-tag-patch")).toBe("make tag-patch");
  });

  it("rtk の包みを剥がす", () => {
    expect(unwrap("rtk run pnpm build")).toBe("pnpm build");
  });

  it("`sh -c` の引用の中身を取り出す", () => {
    expect(unwrap("bash -c 'make tag-patch'")).toBe("make tag-patch");
  });

  it("重なった包みを剥がし切る", () => {
    expect(unwrap("rtk run make ai-tag-patch")).toBe("make tag-patch");
  });

  it("環境変数の前置きを落とす", () => {
    expect(unwrap("env APP_ENV=local FOO=1 make tag-patch")).toBe("make tag-patch");
  });

  // ----- 異常系 -----
  it("包みでないものを変えない", () => {
    expect(unwrap("pnpm lint")).toBe("pnpm lint");
  });
});

describe("stripQuoted", () => {
  // ----- 正常系 -----
  it("二重引用の中身を落とす", () => {
    expect(stripQuoted('echo "rm -rf /"')).not.toContain("rm -rf");
  });

  it("単引用の中身を落とす", () => {
    expect(stripQuoted("echo 'make tag-patch'")).not.toContain("make tag-patch");
  });

  it("heredoc の本体を落とす", () => {
    expect(stripQuoted("python3 - <<PY\nrm -rf /\nPY")).not.toContain("rm -rf");
  });

  // ----- 異常系 -----
  it("引用の外は残す", () => {
    expect(stripQuoted('make tag-patch "x"')).toContain("make tag-patch");
  });
});

describe("judge", () => {
  // ----- 正常系: 前方一致が届かない位置 -----
  it("引数なしの呼び方を捕まえる", () => {
    expect(judge("make tag-patch", LITERALS)).toBe("make tag-patch");
  });

  it("区切りの後ろに現れても捕まえる", () => {
    expect(judge("pnpm build && make tag-patch", LITERALS)).toBe("make tag-patch");
  });

  it("コマンド置換の中でも捕まえる", () => {
    expect(judge("$(make setup-repo)", LITERALS)).toBe("make setup-repo");
  });

  it("包みの中身を捕まえる", () => {
    expect(judge("rtk run rm -rf /", LITERALS)).toBe("rm -rf");
  });

  // ----- 正常系: flag の並べ替えと束ね -----
  it("宣言に無い並びの短 flag を捕まえる", () => {
    expect(judge("rm -fr dist", LITERALS)).toBe("rm -rf");
  });

  it("余分な短 flag が混ざっていても捕まえる", () => {
    expect(judge("rm -rvf dist", LITERALS)).toBe("rm -rf");
  });

  it("離して書いた短 flag を捕まえる", () => {
    expect(judge("rm -r -f dist", LITERALS)).toBe("rm -rf");
  });

  it("長 flag を前方一致で捕まえる", () => {
    expect(judge("git push --force-with-lease", LITERALS)).toBe("git push --force");
  });

  // ----- 異常系: 止めてはならないもの -----
  it("求める短 flag が揃わなければ通す", () => {
    expect(judge("rm -i dist", LITERALS)).toBeUndefined();
  });

  it("短 flag の大文字と小文字を混同しない", () => {
    expect(judge("git branch -D x", LITERALS)).toBe("git branch -D");
    expect(judge("git branch -d x", LITERALS)).toBe("git branch -d");
  });

  it("綴りが前方一致するだけの別 target を通す", () => {
    expect(judge("make tag-patch-dry", LITERALS)).toBeUndefined();
  });

  it("引用の中の綴りで止めない", () => {
    expect(judge('echo "rm -rf /"', LITERALS)).toBeUndefined();
  });

  it("heredoc の散文で止めない", () => {
    expect(judge("cat <<PY\nrm -rf は危険\nPY", LITERALS)).toBeUndefined();
  });

  it("包みそのものは止めない", () => {
    expect(judge("rtk run pnpm build", LITERALS)).toBeUndefined();
  });

  it("塞がれていないコマンドを通す", () => {
    expect(judge("pnpm lint", LITERALS)).toBeUndefined();
  });

  it("宣言が空なら何も止めない", () => {
    expect(judge("rm -rf /", [])).toBeUndefined();
  });
});

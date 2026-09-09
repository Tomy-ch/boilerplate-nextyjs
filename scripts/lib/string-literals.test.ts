import { describe, expect, it } from "vitest";

import { listStringLiterals } from "./string-literals";

describe("listStringLiterals", () => {
  // ----- 正常系 -----
  it("二重引用符と単引用符の中身を、書かれた順に返す", () => {
    expect(listStringLiterals(`goto("/about"); goto('/terms');`)).toEqual(["/about", "/terms"]);
  });

  it("逃がした引用符を含む文字列を、閉じたものとして読む", () => {
    expect(listStringLiterals(String.raw`goto("/a\"b");`)).toEqual(['/a"b']);
  });

  it("テンプレート文字列は、差し込みより前だけを返す", () => {
    expect(listStringLiterals(`goto(\`/login?returnUrl=\${url}\`);`)).toEqual([
      "/login?returnUrl=",
    ]);
  });

  it("差し込みで始まるテンプレート文字列は空を返す", () => {
    expect(listStringLiterals(`goto(\`\${origin}/api\`);`)).toEqual([""]);
  });

  it("差し込みの内側にある文字列と入れ子の括弧を、外側の中身として読まない", () => {
    expect(listStringLiterals(`goto(\`/a\${ { k: "/inner" }.k }/b\`);`)).toEqual(["/a"]);
  });

  it("差し込みの内側にあるテンプレート文字列も読まない", () => {
    expect(listStringLiterals(`goto(\`/a\${\`/inner\`}\`);`)).toEqual(["/a"]);
  });

  it("逃がした文字をテンプレート文字列の頭でも読む", () => {
    expect(listStringLiterals(`goto(\`/a\\\`b\`);`)).toEqual(["/a`b"]);
  });

  it("差し込みより後ろの逃がした文字は読まない", () => {
    expect(listStringLiterals(`goto(\`/a\${x}\\n/b\`);`)).toEqual(["/a"]);
  });

  it("正規表現リテラルの中の引用符を、文字列の始まりとして読まない", () => {
    // 読み違えると走査が乗っ取られ、同じ行の後続のリテラルが丸ごと消える。
    expect(listStringLiterals('if (/["]/.test(x)) goto("/maintenance");')).toEqual([
      "/maintenance",
    ]);
  });

  it("文字クラスの中の区切りで正規表現を終わらせない", () => {
    expect(listStringLiterals('if (/[/"]/.test(x)) goto("/maintenance");')).toEqual([
      "/maintenance",
    ]);
  });

  it("逃がした区切りで正規表現を終わらせない", () => {
    expect(listStringLiterals(String.raw`if (/\/"/.test(x)) goto("/maintenance");`)).toEqual([
      "/maintenance",
    ]);
  });

  it("値の直後の区切りは除算として読む", () => {
    // 正規表現と読むと、次の区切りまでの `"` を飲み込む。
    expect(listStringLiterals('const half = width / 2; goto("/maintenance");')).toEqual([
      "/maintenance",
    ]);
  });

  it("正規表現の直後の区切りも除算として読む", () => {
    expect(listStringLiterals('const n = /a/.source.length / 2; goto("/x");')).toEqual(["/x"]);
  });

  it("空白は値の切れ目を作らない", () => {
    expect(listStringLiterals('const half = width   / 2; goto("/x");')).toEqual(["/x"]);
  });

  it("行コメントの中は読まない", () => {
    expect(listStringLiterals('// "/about" を開く\ngoto("/terms");')).toEqual(["/terms"]);
  });

  it("ブロックコメントの中は読まない", () => {
    expect(listStringLiterals('/* "/about" */ goto("/terms");')).toEqual(["/terms"]);
  });

  it("ソースの先頭に来た区切りは正規表現として読む", () => {
    expect(listStringLiterals('/["]/.test(x); goto("/maintenance");')).toEqual(["/maintenance"]);
  });

  it("関数呼び出しの直後の区切りも除算として読む", () => {
    expect(listStringLiterals('const n = foo() / 2; goto("/x");')).toEqual(["/x"]);
  });

  it("添字アクセスの直後の区切りも除算として読む", () => {
    expect(listStringLiterals('const n = arr[0] / 2; goto("/x");')).toEqual(["/x"]);
  });

  it("文字クラスの中で逃がした閉じ括弧でクラスを閉じない", () => {
    // 閉じたと読むと正規表現が早く終わり、残りの引用符から文字列を読み始める。
    expect(listStringLiterals(String.raw`if (/[\]/"]/.test(x)) goto("/maintenance");`)).toEqual([
      "/maintenance",
    ]);
  });

  it("逃がした改行は文字列を打ち切らない", () => {
    expect(listStringLiterals('goto("/a\\\nb");')).toEqual(["/a\nb"]);
  });

  it("差し込みでない `$` はそのまま中身に含める", () => {
    expect(listStringLiterals("goto(`/price/$5`);")).toEqual(["/price/$5"]);
  });

  // ----- 異常系 -----
  it("閉じないブロックコメントは末尾まで読み飛ばす", () => {
    expect(listStringLiterals('goto("/terms"); /* "/about"')).toEqual(["/terms"]);
  });

  it("閉じない正規表現は行までで打ち切り、次の行から読み直す", () => {
    expect(listStringLiterals('const re = /abc\ngoto("/terms");')).toEqual(["/terms"]);
  });

  it("閉じないまま末尾へ達した正規表現も、そこで打ち切る", () => {
    expect(listStringLiterals('goto("/terms"); const re = /abc')).toEqual(["/terms"]);
  });

  it("行の途中で閉じない引用符は中身を返さず、次の行から読み直す", () => {
    expect(listStringLiterals('goto("/about\ngoto("/terms");')).toEqual(["", "/terms"]);
  });

  it("閉じないまま末尾へ達した引用符は中身を返さない", () => {
    expect(listStringLiterals('goto("/about')).toEqual([""]);
  });

  it("末尾が逃がし記号で終わる引用符も中身を返さない", () => {
    expect(listStringLiterals('goto("/about\\')).toEqual([""]);
  });

  it("閉じないまま末尾へ達したテンプレート文字列は中身を返さない", () => {
    expect(listStringLiterals(`goto(\`/about`)).toEqual([""]);
  });

  it("末尾が逃がし記号で終わるテンプレート文字列も中身を返さない", () => {
    expect(listStringLiterals(`goto(\`/about\\`)).toEqual([""]);
  });
});

// TypeScript のソースから文字列リテラルの中身を拾う字句走査。何に使うかは呼び出し側が決める。
//
// 判定を持たないのは意図で、**追従する相手が違う**ためである。ここが追うのは TypeScript の字句
// 構文（引用符・テンプレート・正規表現・コメントの綴り方）で、拾った値の意味は一切知らない。
// 経路として読む側は [`e2e-routes.ts`](e2e-routes.ts) にある。

/**
 * 直前のトークンが値で終わっていたことを示す文字。
 *
 * @remarks
 * `/` が正規表現の始まりか除算かは、**直前が値かどうか**でしか決まりません。値の直後なら除算、
 * それ以外なら正規表現です。取り違えると走査が乗っ取られます —— 正規表現を除算と読むと中身の
 * 引用符が文字列の開始に見え、以降のリテラルを丸ごと飲み込みます。
 */
const VALUE_END = /[A-Za-z0-9_$)\]]/;

/** 引用符で囲まれた文字列を読む。閉じずに行が終わったものは中身を返さない。 */
function readQuoted(source: string, start: number, quote: string): { value: string; next: number } {
  let value = "";
  let index = start + 1;

  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      value += source[index + 1] ?? "";
      index += 2;
      continue;
    }

    if (char === quote) {
      return { value, next: index + 1 };
    }

    if (char === "\n") {
      return { value: "", next: index + 1 };
    }

    value += char;
    index += 1;
  }

  return { value: "", next: index };
}

/**
 * 差し込み（`${ … }`）の終わりまで送る。
 *
 * @remarks
 * 中身は式なので拾いません。**読み飛ばすだけでは足りず、対応する括弧まで数える必要があります**
 * —— 中に入った文字列や入れ子のテンプレートが持つ `}` が、終わりに見えるためです。
 */
function skipInterpolation(source: string, start: number): number {
  let index = start;
  let depth = 1;

  while (index < source.length && depth > 0) {
    const char = source[index];

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    } else if (char === '"' || char === "'") {
      index = readQuoted(source, index, char).next;
      continue;
    } else if (char === "`") {
      index = readTemplate(source, index).next;
      continue;
    }

    index += 1;
  }

  return index;
}

/**
 * テンプレート文字列を読み、**最初の `${` より前だけ**を返す。
 *
 * @remarks
 * 差し込みの後ろは値が実行時にしか決まらないので、静的には読めません。差し込みで始まるものは
 * 頭が空になります。
 */
function readTemplate(source: string, start: number): { value: string; next: number } {
  let value = "";
  let index = start + 1;
  let inHead = true;

  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      if (inHead) {
        value += source[index + 1] ?? "";
      }

      index += 2;
      continue;
    }

    if (char === "`") {
      return { value, next: index + 1 };
    }

    if (char === "$" && source[index + 1] === "{") {
      inHead = false;
      index = skipInterpolation(source, index + 2);
      continue;
    }

    if (inHead) {
      value += char;
    }

    index += 1;
  }

  return { value: "", next: index };
}

/**
 * 正規表現リテラルの終わりまで送る。
 *
 * @remarks
 * 文字クラス（`[...]`）の中の `/` は区切りになりません。中身は拾いませんが、**読み飛ばすこと
 * 自体が要ります** —— 素通りさせると中の引用符が文字列の開始に見え、同じ行の後続のリテラルが
 * 走査から消えます。
 */
function skipRegExp(source: string, start: number): number {
  let index = start + 1;
  let inClass = false;

  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      index += 2;
      continue;
    }

    // 閉じない正規表現は行で終わる。行を跨いで探すと、次の行の `/` までを飲み込む。
    if (char === "\n") {
      return index;
    }

    if (char === "[") {
      inClass = true;
    } else if (char === "]") {
      inClass = false;
    } else if (char === "/" && !inClass) {
      return index + 1;
    }

    index += 1;
  }

  return index;
}

/** 終わりの綴りまで送る。閉じていなければ末尾まで。 */
function skipTo(source: string, start: number, terminator: string): number {
  const end = source.indexOf(terminator, start);

  return end === -1 ? source.length : end + terminator.length;
}

/** コメントの始まりなら、その終わりまで送った位置を返す。コメントでなければ `null`。 */
function skipCommentAt(source: string, index: number): number | null {
  if (source[index] !== "/") {
    return null;
  }

  if (source[index + 1] === "/") {
    return skipTo(source, index + 2, "\n");
  }

  return source[index + 1] === "*" ? skipTo(source, index + 2, "*/") : null;
}

/**
 * ソースに現れる文字列リテラルの中身を、書かれた順に返す。
 *
 * @remarks
 * **コメントの中は読みません。** 散文がバッククォートや引用符で語を囲うのは普通のことで、拾うと
 * 書き方を変えただけで呼び出し側の判定が動きます。
 *
 * テンプレート文字列は差し込みより前の**静的な頭**だけを返します。差し込みで始まるものと、閉じ
 * ないまま行や末尾に達したものは空文字になります。**空文字も 1 件として返す**ので、意味のある値
 * だけを取る絞り込みは呼び出し側が持ちます。
 *
 * @param source - TypeScript のソース 1 本
 */
export function listStringLiterals(source: string): string[] {
  const found: string[] = [];
  let index = 0;
  // 直前の意味のあるトークンが値で終わったか。`/` の読み方がこれで決まる（{@link VALUE_END}）。
  let afterValue = false;

  while (index < source.length) {
    const char = source.charAt(index);

    const afterComment = skipCommentAt(source, index);

    if (afterComment !== null) {
      index = afterComment;
      continue;
    }

    if (char === "/" && !afterValue) {
      index = skipRegExp(source, index);
      // 正規表現は値である。直後の `/` は除算として読む。
      afterValue = true;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      const literal = char === "`" ? readTemplate(source, index) : readQuoted(source, index, char);

      found.push(literal.value);
      index = literal.next;
      afterValue = true;
      continue;
    }

    // 空白は値の切れ目を作らない。`x /re/` の `x` と `/` の間に何個あっても直前は `x` のまま。
    if (!/\s/.test(char)) {
      afterValue = VALUE_END.test(char);
    }

    index += 1;
  }

  return found;
}

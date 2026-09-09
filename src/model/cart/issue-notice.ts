import type { CartLine, CartLineIssue } from "./cart";

/** 明細に立った事情 1 件の見せ方。 */
export type CartIssueNotice = {
  /** 買えないことを表すか。表示の強さを決めるのに使う。 */
  readonly blocking: boolean;
  /** 利用者に見せる一文。 */
  readonly message: string;
};

/**
 * 明細に立った事情を、画面に出す一文へ写す。
 *
 * @remarks
 * 判定そのものはバックエンドが済ませています。ここが決めるのは言い方だけで、どの事情が買えない
 * ことを意味するかも契約の区分に従います。
 *
 * 在庫不足にだけ数を差し込みます。利用者が次に取る行動が「いくつまで減らすか」であり、その数を
 * 明細が持っているためです。上限が判らない場合は数を伏せます。
 *
 * @param issue - 明細に立った事情
 * @param availableQuantity - 在庫が足りない場合に、今買える上限
 */
export function cartIssueNotice(
  issue: CartLineIssue,
  availableQuantity: number | null,
): CartIssueNotice {
  switch (issue) {
    case "notFound":
      return { blocking: true, message: "この商品は取り扱いが終了しました。" };
    case "unpublished":
      return { blocking: true, message: "この商品は現在購入できません。" };
    case "discontinued":
      return { blocking: true, message: "この商品は廃番になりました。" };
    case "outOfStock":
      return { blocking: true, message: "在庫がありません。" };
    case "insufficientStock":
      return {
        blocking: true,
        message:
          availableQuantity === null
            ? "在庫が足りません。"
            : `在庫が ${availableQuantity} 個までです。`,
      };
    case "priceIncreased":
      return { blocking: false, message: "カートに入れたときより価格が上がっています。" };
    case "priceDecreased":
      return { blocking: false, message: "カートに入れたときより価格が下がっています。" };
  }
}

/**
 * その明細が今買えるか。
 *
 * @remarks
 * 事情が 1 つも立っていないことと同じです。小計の合算対象もこの条件であり、判定はバックエンドが
 * 済ませています。
 */
export function isPurchasable(line: CartLine): boolean {
  return line.issues.length === 0;
}

/**
 * その明細が今は買えない事情を抱えているか。
 *
 * @remarks
 * {@link isPurchasable} と別に要ります。値が変わっただけの明細は買えますが、小計の合算からは
 * 外れるためです。行を弱めて見せてよいのは買えない明細だけです。
 */
export function hasBlockingIssue(line: CartLine): boolean {
  return line.issues.some((issue) => cartIssueNotice(issue, line.availableQuantity).blocking);
}

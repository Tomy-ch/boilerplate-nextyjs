import { cn } from "@/components/cn";
import { AlertTriangleIcon, CircleAlertIcon } from "@/components/icon";
import type { CartLineIssue } from "@/model/cart/cart";
import { cartIssueNotice } from "@/model/cart/issue-notice";

/** `CartLineIssues` の props。 */
export type CartLineIssuesProps = {
  /** 明細に立った事情。空なら何も出さない。 */
  issues: readonly CartLineIssue[];
  /** 在庫が足りない場合に、今買える上限。 */
  availableQuantity: number | null;
  /** 事情の並びの最後に足す一文。その画面で何が起きるかを言う。 */
  note: string;
};

/**
 * 明細に立った事情を、その行の中に並べる。
 *
 * @remarks
 * カートと購入確認の両方が使います。**同じ事情を同じ強さと同じ言い方で出すため**で、画面ごとに
 * 描き分けると、片方だけ配色や文言が動きます。画面によって違うのは最後の一文だけなので、
 * それだけを `note` で受け取ります。
 *
 * 事情は同時に複数立ちます。1 つに畳まないのは、値が変わったことと在庫が足りないことが利用者に
 * とって別々の判断だからです。
 *
 * **強さは 3 段階です。** 買えない事情は取り消しの配色と丸の絵柄（対処しないと買えない）、値が
 * 変わった事情は警告の配色と三角の絵柄（買えるが、金額を確かめる必要がある）、画面が足す一文は
 * 本文の補足として弱く出します。値の変動を補足と同じ強さで出すと、**金額が変わったことが読み
 * 飛ばされます**。絵柄も分けるのは、配色だけの区別が色を見分けにくい利用者へ届かないためです
 * （[0100](../../../../../docs/adr/0100-accessibility-target.md)）。
 */
export function CartLineIssues({ issues, availableQuantity, note }: CartLineIssuesProps) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {issues.map((issue) => {
        const notice = cartIssueNotice(issue, availableQuantity);

        return (
          <li
            className={cn(
              "flex items-start gap-1.5 text-xs",
              notice.blocking ? "text-destructive" : "text-warning",
            )}
            key={issue}
          >
            {notice.blocking ? (
              <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            )}
            {notice.message}
          </li>
        );
      })}
      <li className="text-muted-foreground text-xs">{note}</li>
    </ul>
  );
}

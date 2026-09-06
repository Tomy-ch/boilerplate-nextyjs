import { cn } from "@/components/cn";
import { ChevronUpIcon } from "@/components/icon";
import { withPartSpan } from "@/observability/render-span";

/** `CartDockHandle` の props。 */
export type CartDockHandleProps = {
  /** 器が出ているか。向きと読み上げの文言に効く。 */
  shown: boolean;
  /** 押したときの切り替え。 */
  onToggle: () => void;
};

const OPEN_LABEL = "小計を表示する";
const CLOSE_LABEL = "小計を隠す";

/**
 * 画面の下から出す器を、押して開け閉めするつまみ。
 *
 * @remarks
 * **器が隠れているあいだも出ています。** 隠れた状態で画面の下端に残るのはこのつまみだけで、
 * ここが唯一の開く手段になります。
 *
 * 掴んで引く形にはしていません。引く操作は指の移動量と速度で判定が要り、`prefers-reduced-motion`
 * や支援技術からの操作に別の経路を用意することになります。押すだけなら 1 つの経路で済みます。
 */
export const CartDockHandle = withPartSpan(
  "features/cart/ui/dock-handle/dock-handle",
  ({ shown, onToggle }: CartDockHandleProps) => {
    return (
      <button
        aria-expanded={shown}
        aria-label={shown ? CLOSE_LABEL : OPEN_LABEL}
        className="flex h-6 w-16 cursor-pointer items-center justify-center rounded-t-md border border-b-0 bg-background"
        onClick={onToggle}
        type="button"
      >
        <ChevronUpIcon
          aria-hidden="true"
          className={cn(
            "size-4 transition-transform motion-reduce:transition-none",
            shown && "rotate-180",
          )}
        />
      </button>
    );
  },
);

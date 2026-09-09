import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";
import { withPartSpan } from "@/observability/render-span";

/** `SectionFailure` の props。 */
export type SectionFailureProps = {
  /** 出せなかった節の名前。 */
  label: string;
  /** 分類から引いた文言。 */
  message: string;
};

/**
 * 1 つの節だけが取得に失敗したときの表示。
 *
 * @remarks
 * トップは節を並べるだけの画面で、系統同士に依存がありません。1 つ落ちたことを理由に画面全体を
 * 失敗にすると、生きている節まで見られなくなります。
 *
 * 再読み込みの操作を置いていません。ここで取り直せるのはサーバ側の取得であり、押せる操作を
 * 出すなら画面全体の再取得になります。節ごとの部分再取得は、その節を client island へ倒して
 * 初めて成立するもので、並べるだけの画面が負う複雑さではありません。
 *
 * 節の名前を文言に含めるのは、複数の節が同時に落ちたときに同じ文が並ぶためです。どれが
 * 落ちたのかが文からわかる必要があります。
 */
export const SectionFailure = withPartSpan(
  "features/home/ui/section-failure/section-failure",
  ({ label, message }: SectionFailureProps) => {
    return (
      <Alert variant="warning">
        <AlertTitle>{label}を表示できませんでした</AlertTitle>
        <AlertDescription>
          <p>{message}</p>
        </AlertDescription>
      </Alert>
    );
  },
);

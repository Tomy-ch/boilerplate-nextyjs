"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";

import { ALL_PERIOD, type PeriodSelection, toPurchaseHistoryHref } from "./period";
import { type PeriodDraft, toAppliedPeriod, toPeriodDraft } from "./period-draft";

/** 組み立て中の期間と、それを一覧へ反映する手段。 */
export type PeriodFilterDraft = {
  /** いま組み立てている期間。 */
  readonly draft: PeriodDraft;
  /** 組み立てが条件として成り立っているか。成り立っていなければ null。 */
  readonly applied: PeriodSelection | null;
  /** 反映の取得が終わっていないか。 */
  readonly pending: boolean;
  /** 期間を差し替える。一覧はまだ変わらない。 */
  readonly change: (next: PeriodDraft) => void;
  /** 組み立てた期間を一覧へ反映する。履歴を 1 つ積む。 */
  readonly apply: () => void;
  /**
   * 組み立てた期間を、いま居る履歴を差し替えて反映する。
   *
   * @remarks
   * **overlay の中の確定はこちらを使います。** 背面を塞ぐ overlay は開いた時点で履歴を 1 つ
   * 積んでおり（`use-overlay-history.ts`）、そのうえで積むと、戻る操作が 1 度は同じ URL へ
   * 落ちて何も起きない回になります。差し替えれば、overlay が積んだ 1 件が結果の 1 件へ
   * 置き換わり、戻る操作は期間を絞る前の一覧へ 1 度で戻ります。
   */
  readonly applyInPlace: () => void;
  /**
   * 全期間へ戻し、そのまま一覧へ反映する。
   *
   * @remarks
   * こちらは常に履歴を差し替えます。全期間へ戻す操作は overlay の中にしか無く、条件を外すのも
   * overlay の中からの遷移なので、確定と同じ扱いになります。
   */
  readonly reset: () => void;
};

const PeriodFilterDraftContext = createContext<PeriodFilterDraft | null>(null);

/** `PurchaseFilterDraftProvider` の props。 */
export type PurchaseFilterDraftProviderProps = {
  /** いま一覧に効いている期間。 */
  period: PeriodSelection;
  /** 下書きを読む側を含む部分木。 */
  children: ReactNode;
};

/**
 * 組み立て中の期間を持ち、画面で 1 つに保つ。
 *
 * @remarks
 * **入力欄は幅によって 2 か所に現れます。** 広い幅では帯の中に、脇の領域を持てない幅では overlay の
 * 中にあり、どちらも CSS の段で出し分けます。下書きをそれぞれが持つと、幅が変わった時点で入力の
 * 途中が捨てられます。
 *
 * **選んだ時点では反映しません。** 期間の指定は開始日と終了日の 2 つが揃って初めて条件になるため、
 * 途中で反映すると、片方だけを入れた瞬間に契約が受け取れない要求になります。
 *
 * 反映を `useTransition` で包むのは、取得が終わるまで前の一覧を残すためです。包まないと押した
 * 瞬間に一覧が待機表示へ落ち、続けて絞り込む操作の足場が消えます。
 *
 * 一覧に効いている期間が外から変わったら、下書きを捨ててそちらへ揃えます。戻る操作や、絞り込んだ
 * 結果が 0 件のときの「全期間で見る」は入力欄を通らないため、揃えないと画面の一覧と入力欄が
 * 違うものを指します。
 * 揃える判断を描画の中で行うのは、描画のあとで直すと一度古い姿が出てしまうためです。
 */
export function PurchaseFilterDraftProvider({
  period,
  children,
}: PurchaseFilterDraftProviderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const appliedHref = toPurchaseHistoryHref(period);
  const [knownHref, setKnownHref] = useState(appliedHref);
  const [draft, setDraft] = useState<PeriodDraft>(() => toPeriodDraft(period));

  if (knownHref !== appliedHref) {
    setKnownHref(appliedHref);
    setDraft(toPeriodDraft(period));
  }

  const applied = toAppliedPeriod(draft);

  const navigate = useCallback(
    (next: PeriodSelection, inPlace = false) => {
      startTransition(() => {
        const href = toPurchaseHistoryHref(next);

        if (inPlace) {
          router.replace(href);

          return;
        }

        router.push(href);
      });
    },
    [router],
  );

  const change = useCallback((next: PeriodDraft) => {
    setDraft(next);
  }, []);

  const apply = useCallback(() => {
    if (applied !== null) {
      navigate(applied);
    }
  }, [applied, navigate]);

  const applyInPlace = useCallback(() => {
    if (applied !== null) {
      navigate(applied, true);
    }
  }, [applied, navigate]);

  const reset = useCallback(() => {
    setDraft(toPeriodDraft(ALL_PERIOD));
    navigate(ALL_PERIOD, true);
  }, [navigate]);

  const value = useMemo(
    () => ({ draft, applied, pending, change, apply, applyInPlace, reset }),
    [draft, applied, pending, change, apply, applyInPlace, reset],
  );

  return <PeriodFilterDraftContext value={value}>{children}</PeriodFilterDraftContext>;
}

/**
 * 組み立て中の期間を読む。
 *
 * @remarks
 * 供給の外では既定値を返さず、その場で失敗させます。返してしまうと、期間を変えても確定が何も
 * 起こさない画面ができ、壊れていることが誰の目にも見えません。
 *
 * @throws {Error} {@link PurchaseFilterDraftProvider} の外で呼んだとき
 */
export function usePurchaseFilterDraft(): PeriodFilterDraft {
  const draft = use(PeriodFilterDraftContext);

  if (draft === null) {
    throw new Error("PurchaseFilterDraftProvider の外で下書きを読もうとしました");
  }

  return draft;
}

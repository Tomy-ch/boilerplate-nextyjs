/** slide を並べる領域の目印。位置を触る側はこれで領域を見つける。 */
export const CAROUSEL_CONTENT_SLOT = '[data-slot="carousel-content"]';

/** slide 1 枚の目印。 */
export const CAROUSEL_ITEM_SLOT = '[data-slot="carousel-item"]';

/**
 * slide を領域の先頭へ寄せる。
 *
 * @remarks
 * 送りは領域の横スクロールそのものなので、位置を合わせる操作はどれもこれに帰着します。送る操作・
 * 拡大表示・追従する一覧が別々の寄せ方を持つと、同じ「N 枚目へ」が呼び出し元ごとに違う位置で
 * 止まります。
 *
 * ページのスクロールは動かしません。`scrollIntoView` は carousel ごと画面内へ引き寄せるため、
 * 送っただけで読んでいた位置が変わります。
 */
export function alignSlideToStart(container: Element, target: Element): void {
  container.scrollBy({
    left: target.getBoundingClientRect().left - container.getBoundingClientRect().left,
  });
}

/**
 * いま最も見えている slide の位置を返す。slide が無ければ 0。
 *
 * @remarks
 * 拡大表示を閉じる瞬間のように、送り終えた位置を同期で 1 回読むための関数です。
 * `IntersectionObserver` は非同期で、しかも threshold を跨いだときしか報告しないため、閉じる直前の
 * 位置には使えません。
 *
 * 判定は領域との重なり幅で行い、同点（送っている途中に 2 枚が同じだけ見えている状態）は DOM 順で
 * 先を取ります。追従表示を担う `CarouselThumbnails` の割合による判定と同じ結果になります。
 */
export function currentSlideIndex(container: Element): number {
  const slides = [...container.querySelectorAll(CAROUSEL_ITEM_SLOT)];
  const view = container.getBoundingClientRect();
  let best = 0;
  let widest = -1;

  for (const [index, slide] of slides.entries()) {
    const box = slide.getBoundingClientRect();
    const overlap = Math.min(box.right, view.right) - Math.max(box.left, view.left);

    if (overlap > widest) {
      widest = overlap;
      best = index;
    }
  }

  return best;
}

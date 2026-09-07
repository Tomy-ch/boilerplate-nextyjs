// Storybook が build 時に書き出す story 目録 (`storybook-static/index.json`) から、
// 撮影対象の story を取り出す。
//
// 対象は既定で全数で、外れるのは [excluded-stories](excluded-stories.ts) が宣言したものだけ
// ([README](../README.md#何を撮るか))。
import type { ExcludedStory } from "./excluded-stories";

/** 撮影する story 1 件。 */
export type Story = {
  /** `iframe.html?id=` に渡す識別子。基準画像のファイル名でもある。 */
  id: string;
  /** sidebar の見出し。失敗時にどの部品かを読めるようにするために持つ。 */
  title: string;
  /** story の表示名。 */
  name: string;
  /** 見出しの先頭区画。基準画像はこの単位でディレクトリに分かれる。 */
  group: string;
};

type IndexEntry = {
  type?: unknown;
  id?: unknown;
  title?: unknown;
  name?: unknown;
};

type StoryIndex = {
  entries?: unknown;
};

/**
 * 目録の JSON から撮影対象を id 順で返す。
 *
 * @remarks
 * 目録が空、あるいは entries を持たない形だった場合は例外を投げます。0 件へ縮退させると、
 * 撮影対象が 1 つも無い状態が「差分なし」として緑で通ります。
 */
export function parseStoryIndex(json: string): Story[] {
  const index = JSON.parse(json) as StoryIndex;
  const entries = index.entries;
  if (typeof entries !== "object" || entries === null) {
    throw new Error("story 目録に entries がありません");
  }

  const stories: Story[] = [];
  for (const entry of Object.values(entries as Record<string, IndexEntry>)) {
    if (!isStory(entry)) continue;
    stories.push({
      id: entry.id,
      title: entry.title,
      name: entry.name,
      group: storyGroup(entry.title),
    });
  }
  if (stories.length === 0) throw new Error("story 目録に撮影対象がありません");

  return stories.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * 宣言された story を撮影対象から外す。
 *
 * @remarks
 * どの story にも当たらない宣言があれば例外を投げます。story を消したり改名したりしたあとに
 * 宣言だけが残ると、外した理由が実体を失ったまま宣言として居座ります。
 */
export function excludeDeclared(stories: Story[], excluded: readonly ExcludedStory[]): Story[] {
  const known = new Set(stories.map((story) => story.id));
  const stale = excluded
    .map((entry) => entry.id)
    .filter((id) => !known.has(id))
    .sort();
  if (stale.length > 0) {
    throw new Error(`除外の宣言が指す story がありません: ${stale.join(", ")}`);
  }

  const ids = new Set(excluded.map((entry) => entry.id));
  const kept = stories.filter((story) => !ids.has(story.id));
  if (kept.length === 0) throw new Error("除外の宣言が撮影対象を空にしました");

  return kept;
}

// 目録には docs ページも同じ entries に並ぶ。撮るのは story だけで、docs は story の再掲と
// 自動生成の表からなるため、退行はいずれ story 側に出る。
function isStory(
  entry: IndexEntry,
): entry is IndexEntry & { id: string; title: string; name: string } {
  return (
    entry.type === "story" &&
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.name === "string"
  );
}

/**
 * 見出しの先頭区画を、ディレクトリ名に使える形へ落とす。
 *
 * @remarks
 * 基準画像を系統ごとに分ける理由は [README](../README.md#基準画像は別のリポジトリに置く)。
 */
export function storyGroup(title: string): string {
  const separator = title.indexOf("/");
  const head = separator === -1 ? title : title.slice(0, separator);

  return head.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * a11y の addon に、story を描いたあとの自動検査をさせない指定。
 *
 * @remarks
 * `@storybook/addon-a11y` は story を描くたびに axe を走らせます。撮影も a11y の検査も同じ
 * 面を開くので、**1 story につき axe が 2 回走る**ことになります。撮影にとっては丸ごと無駄で、
 * 検査にとっては自分の実行と衝突する相手です（axe は同時実行を拒み `Axe is already running`
 * で落ちる。`a11y.spec.ts` が再試行を持つのはこのため）。
 *
 * 止め方に `globals` を選ぶのは、**この実行にだけ効く**からです。`.storybook/preview.tsx` の
 * parameter で止めると Storybook を開く人からも検査が消えます。
 */
const A11Y_MANUAL = "a11y.manual:!true";

/**
 * story を開く URL を組み立てる。
 *
 * @remarks
 * `globals` で配色テーマを指定します。テーマは `:root` の `data-theme` を切り替える
 * `.storybook/preview.tsx` の decorator が受け取るため、OS の設定ではなく URL で決まります。
 *
 * 併せて {@link A11Y_MANUAL} で addon の自動検査を止めます。
 */
export function storyURL(id: string, theme: string): string {
  const params = new URLSearchParams({
    id,
    globals: `theme:${theme};${A11Y_MANUAL}`,
    viewMode: "story",
  });

  return `/iframe.html?${params.toString()}`;
}

// 撮影対象を絞る。`VRT_ONLY` は基準画像を撮り直すときに、直前に落ちた story だけへ限るための
// 入口で、指定が無ければ全数を撮る。空振り（該当 0 件）は落とす — 綴りを誤った指定が
// 「差分なし」として緑で通ると、承認したはずの画像が更新されないまま残る。
export function selectStories(stories: Story[], only: string | undefined): Story[] {
  if (!only) return stories;
  const wanted = new Set(only.split(",").map((id) => id.trim()));
  const selected = stories.filter((story) => wanted.has(story.id));
  if (selected.length === 0) throw new Error(`VRT_ONLY に該当する story がありません: ${only}`);

  return selected;
}

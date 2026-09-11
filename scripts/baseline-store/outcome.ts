/**
 * 撮り直しの結果を、判断できる形にして返す。
 *
 * @remarks
 * **撮り直しは承認ではありません**（`vrt/README.md`）。承認は人が画素を見て別のラベルで行うので、
 * ここが出す文面は「何が動いたか」を見比べられる形になっていなければ、承認する側は見るものを
 * 持ちません。
 *
 * 置き場は private でありうるため、埋め込んだ画像は 404 になります。前後の 2 つへの**リンク**を
 * 並べるのはそのためで、置き場の比較画面は前後を並べられません。
 */

import { containsUnsafe } from "../lib/accepted-chars.js";
import { composeReviewCommand, REVIEW_KIND, REVIEW_WORKTREE_NOTE } from "../lib/review-command.js";

/**
 * 表へ並べる画像の上限。
 *
 * @remarks
 * 全数の撮り直しは数百枚を動かします。並べ切ると読めないので切りますが、**切ったことは書きます**
 * —— 黙って落とすと、並んでいる数が動いた数だと読まれます。
 */
const IMAGE_ROW_LIMIT = 20;

/** {@link composeRetakeOutcome} が受け取るもの。 */
export type RetakeOutcomeInput = {
  /** ポインタが指す commit。 */
  readonly sha: string;
  readonly count: string;
  /** 撮り直した対象の名前。 */
  readonly ids: string;
  /** ポインタを PR で入れる場合の、その PR の URL。直接 push した場合は空。 */
  readonly pointerPrUrl: string;
  /** 画面の判定がまだ届いていないか。 */
  readonly screensPending: boolean;
  /** 作業ツリーが指すブランチ。 */
  readonly headRef: string;
  /** 撮り直した story の id をカンマで並べたもの。 */
  readonly stories: string;
  /** 撮り直した画面の名前をカンマで並べたもの。 */
  readonly screens: string;
  /** 動いた画像の位置をカンマで並べたもの。 */
  readonly images: string;
  /** 前の一式に対応する画像が無かった位置をカンマで並べたもの。 */
  readonly unpaired: string;
  /** 前の一式の commit。 */
  readonly before: string;
  /** 後の一式の commit。 */
  readonly after: string;
  /** 置き場のリポジトリ（`owner/name`）。 */
  readonly storeRepository: string;
};

/** カンマ区切りを、空を落として配列に読む。 */
function toList(value: string): string[] {
  return value.split(",").filter((item) => item !== "");
}

/**
 * 動いた画像の表。
 *
 * @remarks
 * 前が無い画像は、初めて置かれたか、改名で移ってきたかのどちらかです。存在しない位置への
 * リンクを並べると、押した人には「壊れている」としか見えません。
 */
function composeImageTable(input: RetakeOutcomeInput): string[] {
  const paths = toList(input.images);
  const unpaired = new Set(toList(input.unpaired));
  const rows = paths.slice(0, IMAGE_ROW_LIMIT).map((path) => {
    const after = `[後](https://github.com/${input.storeRepository}/blob/${input.after}/${path})`;
    const before = unpaired.has(path)
      ? "前が無い"
      : `[前](https://github.com/${input.storeRepository}/blob/${input.before}/${path})`;

    return `| \`${path}\` | ${before} | ${after} |`;
  });
  const table = ["### 動いた画像", "", "| 画像 | 前 | 後 |", "| --- | --- | --- |", ...rows].join(
    "\n",
  );

  if (paths.length <= IMAGE_ROW_LIMIT) {
    return [table];
  }

  return [
    table,
    `動いた ${paths.length} 枚のうち ${IMAGE_ROW_LIMIT} 枚だけを並べています。残りは下の見直しの入口で開いてください。`,
  ];
}

/**
 * 手元で開く節。
 *
 * @remarks
 * story と画面で入口が違うので、動いた側のぶんだけ並べます。空の一覧を渡されたコマンドは
 * `make *-review` が断るため、片方だけが動いた撮り直しで空のコマンドを出しません。
 */
function composeReviewSection(input: RetakeOutcomeInput): string[] {
  const commands = [
    composeReviewCommand({ kind: REVIEW_KIND.story, ids: input.stories, headRef: input.headRef }),
    composeReviewCommand({ kind: REVIEW_KIND.screen, ids: input.screens, headRef: input.headRef }),
  ].filter((command) => command !== null);

  if (commands.length === 0) {
    return [];
  }

  return [
    "### 手元で見る",
    "画素が動いた対象を、使い捨ての作業ツリーで開きます。手元の作業ツリーは動かしません。",
    ...commands.map((command) => `\`\`\`bash\n${command}\n\`\`\``),
    "ここで見えるのは**なぜ変わったか**です。**画素を判断する面は上の表**のままで、手元の描画はホストのフォントで描くため元から一致しません（`vrt/README.md`）。",
    REVIEW_WORKTREE_NOTE,
  ];
}

/**
 * 撮り直しが成立したときの文面を組み立てる。
 *
 * @remarks
 * 撮れなかった場合と、他のチェックが落ちていて撮らなかった場合は**呼ばれません** —— どちらも
 * 資材の取得より前に決まるので、この判定を呼べる状態にありません。
 *
 * @param input - 撮り直しの結果と、手元で開く節に差し込む値
 * @returns markdown の文面
 */
export function composeRetakeOutcome(input: RetakeOutcomeInput): string {
  const blocks = [`🎞️ 基準画像を ${input.count} 枚撮り直しました (${input.sha})。`];

  // 呼ぶ側も同じ集合で弾いているが、それに頼らない。**関門はこのモジュールが持ちます** ——
  // 集合を 1 つに保つ意味は、呼び忘れた面が出ないことにあるので、自分が呼ばなければ同じこと
  // になる（`scripts/lib/accepted-chars.ts`）。
  if (!containsUnsafe(input.ids)) {
    blocks.push(`対象: ${input.ids}`);
  }

  if (input.pointerPrUrl !== "") {
    blocks.push(
      `このブランチは直接 push できないため、**ポインタは PR で入れます**: ${input.pointerPrUrl}`,
    );
  }

  // 位置が文字集合を外れていれば表ごと落とす。リンクの中で綴りが記法になりうる。
  if (input.images !== "" && !containsUnsafe(input.images, input.unpaired)) {
    blocks.push(...composeImageTable(input));
  }

  if (input.screensPending) {
    blocks.push(
      "画面は E2E がまだ判定していないため撮り直していません。**ラベルは付けたままです** — E2E の完了に合わせて自動で撮り直します。",
    );
  }

  blocks.push(
    ...composeReviewSection(input),
    input.pointerPrUrl === ""
      ? "**まだ承認ではありません。** 上の表の前後を見比べ、意図した変更であることを確かめたうえで `baseline-approve` ラベルを付けてください。"
      : "**まだ承認ではありません。** 上の表の前後を見比べ、意図した変更であることを確かめたうえで、**上のポインタ PR に** `baseline-approve` ラベルを付けて merge してください。承認はそこに 1 回で足ります。",
    "**`baseline-retake` は外しました。** 1 回の依頼につき 1 回だけ撮ります。もう一度撮るには、付け直したうえで比較（VRT / E2E）を実行し直してください（ラベルは引き金ではなく、完了時に読まれる条件です）。",
  );

  return `${blocks.join("\n\n")}\n`;
}

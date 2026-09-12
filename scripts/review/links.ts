// 落ちた対象の名前を、立てたサーバで開ける URL へ変える。
//
// CI の報告が並べるのは基準画像の名前だけで、それがどの URL かは story の目録と画面の宣言が
// 持つ。名前から URL を組み立てるのをここへ閉じるのは、見る人が sidebar を辿って 1 件ずつ
// 探し当てる作業を残さないため。
import type { ScreenDeclaration } from "../../e2e/lib/screens.js";

export type ReviewLink = {
  /** CI の報告に出ていた名前。 */
  readonly name: string;
  /** ブラウザで開く URL。解決できなかったものは null。 */
  readonly url: string | null;
  /** 開く前に要ること、あるいは解決できなかった理由。 */
  readonly note: string;
};

/**
 * story の id を Storybook の URL へ変える。
 *
 * @remarks
 * 開くのは sidebar 付きの面です。撮影されているのは `iframe.html?id=<id>` の側ですが、
 * 隣の story と見比べられる形でないと「なぜ変わったか」に辿り着けません。
 *
 * @param baseURL - 立てた Storybook の場所（末尾に `/` を含まない）
 * @param ids - CI の報告が出した story の id
 */
export function storyLinks(baseURL: string, ids: readonly string[]): ReviewLink[] {
  return ids.map((id) => ({
    name: id,
    url: `${baseURL}/?path=/story/${encodeURIComponent(id)}`,
    note: "",
  }));
}

/**
 * 画面の名前をアプリの URL へ変える。
 *
 * @remarks
 * 役割を要る画面は、直接開くとログインへ送られます。行き先を持たせた開発用 session の面を
 * 返すので、役割を選べばそのまま目的の画面へ着きます。
 *
 * 宣言に無い名前は落とさず、理由を添えて残します。落とすと、報告に出ていた画面が黙って
 * 一覧から消えます。
 *
 * @param baseURL - 立てたアプリの場所（末尾に `/` を含まない）
 * @param names - CI の報告が出した画面の名前
 * @param screens - 画面の宣言（`e2e/lib/screens.ts` の `SCREENS`）
 * @param sessionPath - 開発用 session の面のパス
 * @param returnParam - 戻り先を持ち回る検索条件の名前
 */
export function screenLinks(
  baseURL: string,
  names: readonly string[],
  screens: readonly ScreenDeclaration[],
  sessionPath: string,
  returnParam: string,
): ReviewLink[] {
  const declared = new Map(
    screens.flatMap((screen) => ("skip" in screen ? [] : [[screen.name, screen] as const])),
  );

  return names.map((name) => {
    const screen = declared.get(name);

    if (screen === undefined) {
      return { name, url: null, note: "このブランチの宣言に無い画面です" };
    }

    if (screen.signedIn === undefined) {
      return { name, url: `${baseURL}${screen.path}`, note: "" };
    }

    const returnUrl = `${returnParam}=${encodeURIComponent(screen.path)}`;

    return {
      name,
      url: `${baseURL}${sessionPath}?${returnUrl}`,
      note: `${screen.signedIn} の session を発行してから開く`,
    };
  });
}

/**
 * 端末へ出す案内文。件数・URL の一覧・見る面についての但し書きを 1 つに組む。
 *
 * @remarks
 * story と画面で但し書きが違います。story 側は、並べた URL と撮影された面が同じでないこと
 * （{@link storyLinks}）を断ります。
 *
 * @param kind - 見る対象（`vrt` / `e2e`）
 * @param links - 開ける先
 */
export function announce(kind: "vrt" | "e2e", links: readonly ReviewLink[]): string {
  const unit = kind === "vrt" ? "story" : "画面";
  const lines = [`${links.length} 件の ${unit} を開けます。`, "", formatLinks(links)];

  if (kind === "vrt") {
    lines.push(
      "",
      "撮影されているのは sidebar の無い面です。`?path=/story/<id>` を `iframe.html?id=<id>` へ読み替えると同じ面が出ます。",
    );
  }

  return lines.join("\n");
}

/**
 * 一覧を端末へ出す形へ整える。
 *
 * @param links - 開ける先
 */
export function formatLinks(links: readonly ReviewLink[]): string {
  const width = Math.max(...links.map((link) => link.name.length));

  return links
    .map((link) => {
      const head = `${link.name.padEnd(width)}  ${link.url ?? "—"}`;

      return link.note === "" ? head : `${head}  (${link.note})`;
    })
    .join("\n");
}

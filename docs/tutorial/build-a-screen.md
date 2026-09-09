# チュートリアル: 画面を 1 つ、端から端まで作る

このリポジトリで **1 つの画面を、契約から表示・送信・テスト・カタログまで通しで作る**手順書である。
規約は [`rules.md`](../rules.md)、判断は [`adr/`](../adr/)、置き場の決め方は
[`design/placement.md`](../design/placement.md) が持つ。この文書はそれらを写さず、**1 つの feature を
依存の順に層を上りながら組み立て、各段の終わりに何が通るようになったかを検査コマンドで示す**。

## 誰のための文書か

- テンプレートからリポジトリを作り、**同梱サンプルを消したあと**に、最初の画面を書き始める人
- 層別 README を一通り読んだが、「実際にどのファイルに何を書くのか」を 1 本の道筋で見たい人
- `pnpm gen` や `new-feature` skill が出したものを、**正しいかどうか判断できる**ようになりたい人

**サンプルを消したあとにこそ読む文書である。** 同梱サンプルは実装の実例だが、テンプレートから
作った側が最初に破棄する。破棄後に残るのは規約と ADR と層別 README で、「で、どう書くのか」を
示すものがこの文書だけになる。だからこの文書は**消える側のコードを参照しない**。

## 何を作るか

自分の「メモ」を扱う feature `notes` を作る。題材はテンプレートから作った側が最初に差し替えるもの
なので、意図して平凡にしてある。

| Route | 画面 | 認証 |
| --- | --- | --- |
| `/notes` | 一覧。題名と更新日時を新しい順に並べる | 必要 |
| `/notes/[id]` | 詳細。本文を読み、編集へ進む | 必要 |
| `/notes/[id]/edit` | 1 件の編集。題名と本文を保存する | 必要 |

3 画面とも認証の内側に置く。**主体を名乗る口と名乗らない口の違い**は Step 3 で扱い、公開の
一覧を作りたい場合にどこが変わるかもそこで示す。

通す層と、そこで書くもの。

| Step | 層 | 書くもの |
| --- | --- | --- |
| 0 | — | サンプルを消し、残った木を確かめる |
| 1 | `openapi/` → `src/adapters/gen/` | 契約を取り込み、wire 型・zod・モックを生成する |
| 2 | `src/model/note/` | 表示用の型、識別子の brand、表示検証 |
| 3 | `src/adapters/server/api/` | 取得と更新の口。分類と資格情報 |
| 4 | `src/features/notes/` | 一覧・詳細の合成（`page-content` / `view` / `ui/`） |
| 5 | `src/app/notes/` | route segment・metadata・器・保護の宣言 |
| 6 | `src/features/notes/` + `src/app/notes/` | 編集の送信（Server Action）と結果の見せ方 |
| 7 | 各層の隣 | テスト。何をどこで見るか |
| 8 | `*.stories.tsx` / `e2e/lib/screens.ts` | カタログと基準画像 |
| 9 | `docs/spec/route/notes/` / `src/features/notes/README.md` | 画面の約束と slice の索引 |

## 依存の順序

依存は内向きだが、**組み立ては契約から始める**。生成物が無いと取得の口が書けず、取得の口が無いと
画面が組めない。

```text
契約（openapi/）
  └─ 生成（src/adapters/gen/ + mocks/）
       └─ model  →  adapters/server  →  features  →  app
                                            └─ 送信（actions.ts）→ テスト → カタログ・基準画像 → 仕様書
```

**画面を作るときの作業順は別にある。** [`playbook.md`](../playbook.md)「画面を作るときの順序」は
ディレクション → story → レビュー → 分離 → 仕様書 → テストの順で、見た目が決まってからテストを
書く。この文書が依存の順に並べているのは、各段の終わりに検査を通せるようにするためであって、
作業順を置き換えるものではない。実際に画面を作るときは、Step 4 の `view` と Step 8 の story を
先に書いてレビューを通し、そのあとで残りを埋める。

各 Step は **目的・触るファイル・実物のコード・迷う分岐の行き先・確認コマンド** を持つ。

## 前提

- ツールチェーンが入っている（`make install-tools` / `pnpm install`）
- 開発サーバとカタログは `APP_ENV=local` で起動する。`pnpm dev` / `pnpm storybook` は
  `package.json` がこれを付ける
- バックエンド無しで進めるなら `APP_API_MODE=mock`。契約から生成したモックが応える
  （[`mocks/README.md`](../../mocks/README.md)）。環境変数の置き場は
  [`env/README.md`](../../env/README.md)
- 認証の内側の画面を開くには session が要る。開発では `/dev/session` が IdP を通さずに発行する
  （[`src/features/dev-session/README.md`](../../src/features/dev-session/README.md)）
- やり直せるよう、作業用のブランチで進める

```bash
git switch -c tutorial/build-a-screen
```

---

## Step 0 — ゼロへリセット

**目的:** 同梱サンプルを消し、何が残るかを確かめる。ここが出発点である。

消す対象は `scripts/setup/remove-sample/sample-manifest.ts` が宣言している。破棄の道具そのものも
対象に含まれ、実行後に自分ごと消える。先に読んでおくと、残る側と消える側の線が判る。

```bash
# 何が消えるかを表示するだけ。書き換えない
DRY_RUN=1 make setup-remove-sample

# 実行。破棄のあと整形・検査・build・test・残留検証まで連鎖する
make setup-remove-sample
```

**残るもの**（この文書が参照してよいのはこちらだけ）:

| 場所 | 残る中身 |
| --- | --- |
| `src/app/` | root layout、`(auth)`、`api/auth` / `api/health` / `api/telemetry`、`dev/session`、`maintenance`、`not-found`、動作確認用の最小の `page.tsx` |
| `src/features/` | `auth` / `dev-session` / `maintenance` と層 README |
| `src/model/` | `action-state` / `pagination` / `datetime` / `search-params` / `session` / `authz` など題材を持たない型と関数 |
| `src/adapters/` | `server/http`（fetch wrapper）/ `server/auth` / `client/http` / `http/`。**`server/api/` と `gen/` は空になる** |
| `src/components/` | 全部。題材の語を持たない部品だけが置かれている |
| `mocks/` | 機構（`stable-responses.ts` / `node.ts` / `serve.ts`）。**`api/` は空になる** |
| `docs/` | ADR・設計解説・規約・層の README・コア残留画面の仕様書 |

**消えるもの:** 題材の画面群（`src/app/(shop)` など）、それに固有の `features` / `model` /
`adapters/server/api` / `stores`、契約（`openapi/api.gen.yaml`）と生成物、題材の仕様書、
題材の E2E ジャーニー。

**確認:** 破棄の連鎖が最後まで緑で終わること。加えて木を見る。

```bash
git status --short
ls src/features src/adapters/server
```

この時点で `src/adapters/server/api/` は無い。以降の Step はこれを作り直していく。

---

## Step 1 — 契約を取り込み、生成する

**目的:** バックエンドの OpenAPI 契約を取り込み、wire 型・zod スキーマ・MSW ハンドラを生成する。
**生成物は編集しない**——ここが「自分で書くもの」と「書いてはいけないもの」の線である。

**この文書が前提にする契約。** 正本はバックエンドのリポジトリにあり、ここは形を示すだけである。
自分の契約に読み替える。

```yaml
paths:
  /v1/notes:
    get:
      operationId: GetNotes
      tags: [notes]
      security: [{ bearerAuth: [] }]
      parameters:
        - { name: first, in: query, schema: { type: integer, minimum: 1, maximum: 50, default: 20 } }
        - { name: after, in: query, schema: { type: string, maxLength: 512 } }
      responses:
        "200":
          content:
            application/json:
              schema: { $ref: "#/components/schemas/NoteListResponse" }
  /v1/notes/{noteId}:
    parameters:
      - { name: noteId, in: path, required: true, schema: { type: string, format: uuid } }
    get:
      operationId: GetNotesDetail
      tags: [notes]
      security: [{ bearerAuth: [] }]
      responses:
        "200":
          content:
            application/json:
              schema: { $ref: "#/components/schemas/NoteDetailResponse" }
        "404": { $ref: "#/components/responses/NotFound" }
    patch:
      operationId: PatchNotesDetail
      tags: [notes]
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/NotePatchRequest" }
      responses:
        "200":
          content:
            application/json:
              schema: { $ref: "#/components/schemas/NoteDetailResponse" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/Conflict" }
components:
  schemas:
    NoteSummary:
      type: object
      required: [id, title, updatedAt]
      properties:
        id: { type: string, format: uuid }
        title: { type: string, maxLength: 100 }
        updatedAt: { type: string, format: date-time }
    NoteListResponse:
      type: object
      required: [items, nextCursor]
      properties:
        items: { type: array, items: { $ref: "#/components/schemas/NoteSummary" } }
        nextCursor: { type: string, nullable: true }
    NoteDetailResponse:
      allOf:
        - { $ref: "#/components/schemas/NoteSummary" }
        - type: object
          required: [body]
          properties:
            body: { type: string, maxLength: 2000 }
    NotePatchRequest:
      type: object
      required: [title, body]
      properties:
        title: { type: string, maxLength: 100 }
        body: { type: string, maxLength: 2000 }
```

**取得座標を宣言する。** `openapi/sources.yaml` の `sources` に 1 本足す。`name` は `api` のまま使うのが
既定で、生成の側（`orval.config.ts` / `scripts/openapi/gen-api-plan.ts`）がその綴りを持っている
（理由は [`openapi/README.md`](../../openapi/README.md)「複数契約」）。

```yaml
sources:
  - name: api
    repo: <owner>/<backend-repo>
    path: openapi/openapi.gen.yaml
    ref: <commit-sha>
```

`ref` はコミット SHA で固定する。`sha` / `fetchedAt` は取得時に書き戻されるので書かない。

```bash
make fetch-api      # sources.yaml の座標から取得し、openapi/api.gen.yaml へ置く
make gen-api        # 型 / zod / MSW ハンドラを生成する
```

**現れるもの（生成物。編集しない）:**

| パス | 中身 |
| --- | --- |
| `src/adapters/gen/api/model/` | wire 型。`NoteSummary` / `NotePatchRequest` など `components.schemas` に対応する |
| `src/adapters/gen/api/endpoints.zod.ts` | operation ごとの zod。`GetNotesResponse` / `GetNotesDetailResponse` / `PatchNotesDetailResponse` / `GetNotesQueryParams` |
| `src/adapters/gen/api/limits.ts` | 検証を伴わない定数だけ。client が引いてよいのはここだけ |
| `mocks/api/endpoints.msw.ts` | 契約駆動の MSW ハンドラ |

**zod の名前は operationId から決まる。** 上の表は前提の契約から導いた綴りで、実際の綴りは生成された
`endpoints.zod.ts` を開いて確かめる。以降のコードはこの綴りを使う。

**契約を入れたときに、生成物の外で書くもの。** サンプルの破棄で空になった配線を戻す。どれも 1 行から
数行で、置き場の理由はそれぞれの README が持つ。

| ファイル | 書くこと | 理由の在処 |
| --- | --- | --- |
| `mocks/handlers.ts` | 生成物を `stableHandlers` へ渡す 1 行 | [`mocks/README.md`](../../mocks/README.md) |
| `scripts/lib/untested-modules.ts` の `GENERATED_MODULES` | `src/adapters/gen/**` と `mocks/api/**` | 書き手の居ないコードにテストを課さない（同ファイルの doc） |
| `src/adapters/README.md` / `mocks/README.md` の frontmatter `coverage-exclusions` | 同じ 2 つのパターン | `scripts/coverage-exclusion.gate.test.ts` が所有側の README に記録を求める |
| `orval.config.ts` の `PATTERNED_MOCK_PROPERTIES` / `operations` | `pattern` を持つ項目と、組で決まる値の指定 | 同ファイルのコメント |

**迷ったら:** 生成物を直したくなったときは契約を直して再生成する
（[0072](../adr/0072-api-type-generation.md)）。契約の取り込み経路と生成物の読み方は
[`design/data-fetching.md`](../design/data-fetching.md)「契約から生成物へ、生成物から表示の型へ」。

**確認:**

```bash
make gen-api-check                 # 契約と生成物の版が揃っている
ls src/adapters/gen/api mocks/api  # 生成物が出ている
```

---

## Step 2 — `model`: 表示の型と、境界での parse

**目的:** 画面が持ち回る型を、契約の型とは別に定義する。**生成型はここへ来ない**。ここが持つのは
表示のための形と、識別子の brand と、表示検証である。

**ファイル:**

- `src/model/note/note.ts` — 表示用の型と、識別子を確定させる関数
- `src/model/note/note-schema.ts` — 編集フォームの表示検証

```ts
// src/model/note/note.ts
import * as z from "zod/mini";

import type { CursorPage } from "../pagination";

/** メモの識別子を確定させるスキーマ。生成スキーマの中で組み合わせる呼び出しだけがこれを直接使う。 */
export const noteIdSchema = z.string().brand<"note">();

/**
 * メモを指す識別子。
 *
 * @remarks
 * 素の `string` を代入できない形にしてあります。識別子はどれも UUID の文字列で、取り違えても
 * 型では止まらないためです。
 */
export type NoteId = z.infer<typeof noteIdSchema>;

/**
 * 文字列をメモの識別子として確定させる。
 *
 * @remarks
 * **呼んでよいのは境界だけ**です。外から来た値を確定させる場所（`adapters` の検証の出口・
 * フォームの受け取り・route の動的セグメント）で 1 度だけ通し、内側では確定した型を持ち回ります。
 * 実在するかは検査しません。存在しない値は取得が `not-found` として返します。
 */
export function toNoteId(value: string): NoteId {
  return noteIdSchema.parse(value);
}

/** 一覧に並ぶメモ 1 件。本文は含まない。 */
export type NoteSummary = {
  readonly id: NoteId;
  readonly title: string;
  readonly updatedAt: Date;
};

/** cursor 方式で取得した一覧の 1 ページ。 */
export type NotePage = CursorPage<NoteSummary>;

/** メモ 1 件の全体。 */
export type Note = NoteSummary & {
  readonly body: string;
};
```

```ts
// src/model/note/note-schema.ts
import * as z from "zod/mini";

/**
 * メモ入力の表示検証。
 *
 * @remarks
 * 手書きなのは、これが**表示のための規則**であって wire contract ではないためです。生成スキーマを
 * 入力検証へ持ち込むと、契約の型が `model` と feature へ漏れます。契約側の検証は `adapters` の
 * 境界が生成スキーマで別に行います。
 *
 * 上限は契約の更新要求側に合わせます。文言は項目名を主語にして書きます。
 */
export const noteSchema = z.object({
  title: z
    .string()
    .check(
      z.minLength(1, "題名を入力してください。"),
      z.maxLength(100, "題名は 100 文字以内で入力してください。"),
    ),
  body: z.string().check(z.maxLength(2000, "本文は 2000 文字以内で入力してください。")),
});

/** {@link noteSchema} を通した入力。 */
export type NoteInput = z.infer<typeof noteSchema>;

/** 入力欄として現れる項目名。項目エラーのキーになる。 */
export type NoteField = keyof NoteInput;

/**
 * 空欄を受け付けない項目かを返す。
 *
 * @remarks
 * 必須かどうかを列挙せず、スキーマへ空文字を通して判定します。列挙すると、規則を緩めたのに
 * 画面が必須のままという状態を作れます。
 */
export function isRequiredNoteField(field: NoteField): boolean {
  return !noteSchema.shape[field].safeParse("").success;
}
```

押さえること。

- **日時は `Date` で持つ。** 契約は ISO 文字列で運ぶが、文字列を内層へ出さない。`Date` へ写すのは
  Step 3 の口である
- **識別子は brand を付ける。** `toNoteId` を呼んでよいのは境界だけ。内側は `NoteId` を持ち回る
  （[0029](../adr/0029-type-design-discipline.md)）
- **`zod/mini` を使う。** 表示検証はブラウザにも配られるので、classic の `zod` を引くと束が膨らむ
  （[`design/forms.md`](../design/forms.md)「検証の二層と、その正」）

**迷ったら:** `model` に置いてよいものは [`src/model/README.md`](../../src/model/README.md)
「受け入れるもの / 受け入れないもの」。業務ルール（バックエンドが決めること）はここに来ない
（[0070](../adr/0070-backend-role-separation.md)）。

**確認:** テストを隣に置いてから回す（テストの書き方は Step 7）。

```bash
pnpm exec vitest run src/model/note
```

---

## Step 3 — `adapters/server`: 取得と更新の口

**目的:** 契約の形を受け取り、`model` の型を返す口を作る。fetch wrapper（締切・再試行・遮断・
応答の検証・status の分類）は `adapters/server/http/request.ts` が持つので、ここが書くのは
**口の分類・変換・パスの組み立て**だけである。

**ファイル:** `src/adapters/server/api/notes.ts`

```ts
// src/adapters/server/api/notes.ts
import "server-only";

import { cache } from "react";
import type { z } from "zod";

import { getApiConfig } from "@/config/api/api.server";
import { getHttpConfig } from "@/config/http/http.server";
import { type Note, type NoteId, type NotePage, type NoteSummary, toNoteId } from "@/model/note/note";

import {
  GetNotesDetailResponse,
  GetNotesResponse,
  PatchNotesDetailResponse,
} from "../../gen/api/endpoints.zod";
import type { NotePatchRequest } from "../../gen/api/model";
import { getAccessToken } from "../auth/session";
import { createHttpClient, type UserScopedHttpClient } from "../http/request";

const NOTES_PATH = "/v1/notes";

/** 一覧が 1 度に引く件数。契約の既定値に頼らず、画面の側で決める。 */
export const NOTE_PAGE_SIZE = 20;

type WireNoteSummary = z.infer<typeof GetNotesResponse>["items"][number];
type WireNote = z.infer<typeof GetNotesDetailResponse>;

let client: UserScopedHttpClient | undefined;

/**
 * 主体を名乗って引く口が共有する接続先。
 *
 * @remarks
 * `getBearerToken` には import した口（`getAccessToken`）をそのまま渡します。解決済みの値を掴むと、
 * 要求のたびに cookie を読む形が崩れます（置き方は `adapters` の README）。
 */
function getClient(): UserScopedHttpClient {
  client ??= createHttpClient({
    scope: "user-scoped",
    baseUrl: getApiConfig().baseUrl,
    maxUrlBytes: getHttpConfig().maxUrlBytes,
    getBearerToken: getAccessToken,
  });

  return client;
}

function toNoteSummary(wire: WireNoteSummary): NoteSummary {
  return {
    id: toNoteId(wire.id),
    title: wire.title,
    updatedAt: new Date(wire.updatedAt),
  };
}

function toNote(wire: WireNote): Note {
  return { ...toNoteSummary(wire), body: wire.body };
}

/**
 * 自分のメモを 1 ページ取得する。
 *
 * @remarks
 * 更新日時の降順で返ります。次ページの鍵は応答の `nextCursor` に載ります。
 *
 * @param after - 前のページが返した cursor。先頭なら省略
 */
export const getMyNotes = cache(async (after?: string): Promise<NotePage> => {
  const wire = await getClient().request({
    path: NOTES_PATH,
    searchParams: { first: String(NOTE_PAGE_SIZE), after },
    schema: GetNotesResponse,
  });

  return { items: wire.items.map(toNoteSummary), nextCursor: wire.nextCursor };
});

/**
 * 自分のメモを 1 件取得する。
 *
 * @remarks
 * 他人のメモも存在しないメモも、区別なく `not-found` になります。契約が存在を秘匿するためで、
 * 呼び出し側が所有者を確かめる必要はありません。
 */
export const getMyNote = cache(async (id: NoteId): Promise<Note> => {
  const wire = await getClient().request({
    path: `${NOTES_PATH}/${encodeURIComponent(id)}`,
    schema: GetNotesDetailResponse,
  });

  return toNote(wire);
});

/**
 * メモの題名と本文を保存する。
 *
 * @remarks
 * 送るのは絶対値（設定）なので、再送しても結果は変わりません。冪等キーは要りません。
 * 他の場所で先に更新されていた場合は `conflict` として返ります。
 */
export async function updateMyNote(id: NoteId, input: NotePatchRequest): Promise<Note> {
  const wire = await getClient().request({
    path: `${NOTES_PATH}/${encodeURIComponent(id)}`,
    method: "PATCH",
    body: { title: input.title, body: input.body } satisfies NotePatchRequest,
    schema: PatchNotesDetailResponse,
  });

  return toNote(wire);
}
```

押さえること。

- **`scope` は口の性質で決まる。** 資格情報を載せうる口は、載せなかった回も含めて
  `"user-scoped"` である。この分類は型で効き、`cache` / `tags` を渡せない
  （[0112](../adr/0112-data-classification-cache-boundary.md)）
- **全部の口を `cache()` で包む。** 同じ描画の中で `generateMetadata` と画面が同じ口を呼んでも
  1 往復にまとまる。ただし書き込みは包まない
- **wire 型はここから出ない。** `toNoteSummary` / `toNote` が `model` の型へ写し、`z.infer` した型は
  このファイルの中だけで使う（[0020](../adr/0020-adopted-architecture.md) 設計原則 3）
- **path の可変部分は `encodeURIComponent` で包む。** `..` は符号化しても残るが、wrapper が
  組み立ての前に `invalid-argument` で落とす

**分岐: 主体を名乗らない一覧を作りたいとき。** 誰でも読める一覧なら口は `"public"` になり、
`createHttpClient` を直に引かず `server/api/public-client.ts` の `getPublicClient()` を引く。
その口だけが `use cache` / `cacheLife` / `cacheTag` を名乗れる。書き方と、なぜ口の側が寿命を持つかは
[`src/adapters/README.md`](../../src/adapters/README.md)「リクエストをまたいで残すのは `use cache` の側」
と [0071](../adr/0071-bff-api-integration.md)。読み取りが公開で書き込みが主体を要する場合の
`allowAnonymous` も同じ README にある。

**分岐: ブラウザから 2 ページ目以降を取りたいとき。** 初回は Server Component がこの口を直接呼び、
続きだけを `app/api/notes/route.ts`（BFF）と `adapters/client/api/notes.ts` で取る。経路と
持ち物の分担は [`design/data-fetching.md`](../design/data-fetching.md)「一覧の続きを取る」、判断は
[0073](../adr/0073-pagination-fetch-boundary.md)。この文書は先頭ページだけで進める。

**確認:** 口は HTTP 境界を持つので `integration` として MSW で確かめる（Step 7）。境界の規則は ESLint
にしか無いものがあるので、対象を絞って掛ける。

```bash
pnpm exec vitest run src/adapters/server/api/notes.test.ts
pnpm exec eslint src/adapters/server/api/notes.ts
```

---

## Step 4 — `features/notes`: 一覧と詳細の合成

**目的:** 取得を編成し、画面を組む。**取得を持つ `page-content.tsx`** と、**props だけで描ける
`view.tsx`** を分けるのがこの層の形で、`view` は取得無しで全状態を story から出せる。

**ファイル:**

```text
src/features/notes/
├── README.md                       # Step 9 で書く（雛形は docs/templates/feature-readme.md）
├── paths.ts                        # この feature が持つ 3 つの経路
├── load-note.ts                    # 1 件の取得と、見つからないことの扱い。詳細と編集が共有する
├── note.fixture.ts                 # story とテストが読む固定値
├── list/
│   ├── page-content.tsx            # 先頭ページの取得
│   ├── view.tsx                    # 一覧の画面。空も持つ
│   └── ui/
│       ├── note-list/note-list.tsx # 並び
│       ├── empty/empty.tsx         # 1 件も無いとき
│       └── skeleton/skeleton.tsx   # 待機表示
└── detail/
    ├── page-content.tsx
    └── view.tsx
```

**掘り方は 2 軸だけ**——第 1 軸が画面（`list` / `detail`）、第 2 軸が性質（`ui/`）である。どの画面にも
属さないもの（`paths.ts` / `load-note.ts`）は画面を挟まず直下へ置く
（[0027](../adr/0027-directory-structure.md)「co-location 方針」）。

```ts
// src/features/notes/paths.ts
/** 一覧の経路。保護の宣言（`model/authz`）と同じ綴りを名乗る。 */
export const NOTE_LIST_PATH = "/notes";

/** 1 件の詳細の経路。 */
export function noteDetailPath(id: string): string {
  return `${NOTE_LIST_PATH}/${encodeURIComponent(id)}`;
}

/** 1 件の編集の経路。 */
export function noteEditPath(id: string): string {
  return `${noteDetailPath(id)}/edit`;
}
```

```ts
// src/features/notes/load-note.ts
import { notFound } from "next/navigation";

import { getMyNote } from "@/adapters/server/api/notes";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { type Note, toNoteId } from "@/model/note/note";

/**
 * route が受け取った識別子でメモを引き、`not-found` だけを Next の境界へ渡す。
 *
 * @remarks
 * try の範囲は取得だけです。それ以外の失敗は分類のまま投げ直し、route の `error` 境界が受けます。
 */
export async function loadNote(id: string): Promise<Note> {
  try {
    return await getMyNote(toNoteId(id));
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.NOT_FOUND) {
      notFound();
    }

    throw error;
  }
}
```

```tsx
// src/features/notes/list/page-content.tsx
import { getMyNotes } from "@/adapters/server/api/notes";
import { withScreenSpan } from "@/observability/render-span";

import { NoteListView } from "./view";

/** 一覧の取得と組み立て。先頭ページだけを引く。 */
export const NoteListPageContent = withScreenSpan("features/notes/list/page-content", async () => {
  const page = await getMyNotes();

  return <NoteListView notes={page.items} />;
});
```

```tsx
// src/features/notes/list/view.tsx
import type { NoteSummary } from "@/model/note/note";
import { withScreenSpan } from "@/observability/render-span";

import { NoteListEmpty } from "./ui/empty/empty";
import { NoteList } from "./ui/note-list/note-list";

/** `NoteListView` の props。 */
export type NoteListViewProps = {
  /** 並べるメモ。空なら空の表示になる。 */
  notes: readonly NoteSummary[];
};

/**
 * 一覧の画面。取得を持たないので、空も含めて全状態を story から出せる。
 */
export const NoteListView = withScreenSpan(
  "features/notes/list/view",
  ({ notes }: NoteListViewProps) => {
    return notes.length === 0 ? <NoteListEmpty /> : <NoteList notes={notes} />;
  },
);
```

```tsx
// src/features/notes/list/ui/note-list/note-list.tsx
import Link from "next/link";

import { formatDateTime } from "@/model/datetime";
import type { NoteSummary } from "@/model/note/note";
import { withPartSpan } from "@/observability/render-span";

import { noteDetailPath } from "../../../paths";

/** `NoteList` の props。 */
export type NoteListProps = {
  /** 並べるメモ。1 件以上ある。 */
  notes: readonly NoteSummary[];
};

/** メモの並び。行そのものが詳細への行き先になる。 */
export const NoteList = withPartSpan(
  "features/notes/list/ui/note-list/note-list",
  ({ notes }: NoteListProps) => {
    return (
      <ul className="divide-y rounded-lg border">
        {notes.map((note) => (
          <li key={note.id}>
            <Link
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 hover:bg-muted"
              href={noteDetailPath(note.id)}
            >
              <span className="font-emphasis">{note.title}</span>
              <time className="text-sm text-muted-foreground" dateTime={note.updatedAt.toISOString()}>
                {formatDateTime(note.updatedAt)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    );
  },
);
```

```tsx
// src/features/notes/list/ui/empty/empty.tsx
import { withPartSpan } from "@/observability/render-span";

/** 並べるものが無いときの表示。 */
export const NoteListEmpty = withPartSpan("features/notes/list/ui/empty/empty", () => {
  return (
    <div className="flex flex-col items-start gap-4 py-8">
      <p className="text-muted-foreground">メモがまだありません。</p>
    </div>
  );
});
```

```tsx
// src/features/notes/list/ui/skeleton/skeleton.tsx
import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 枠だけで見せる行数。1 画面に収まる範囲に留める。 */
const PLACEHOLDER_ROWS = 5;

const ROWS = Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => index);

/** 一覧の待機表示。実際に並ぶ行と同じ高さ・同じ区切りで枠だけを出す。 */
export const NoteListSkeleton = withPartSpan("features/notes/list/ui/skeleton/skeleton", () => {
  return (
    <ul aria-hidden="true" className="divide-y rounded-lg border">
      {ROWS.map((row) => (
        <li className="flex items-center justify-between gap-4 px-4 py-4" key={row}>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-28" />
        </li>
      ))}
    </ul>
  );
});
```

```tsx
// src/features/notes/detail/page-content.tsx
import { withScreenSpan } from "@/observability/render-span";

import { loadNote } from "../load-note";
import { NoteDetailView } from "./view";

/** `NoteDetailPageContent` の props。 */
export type NoteDetailPageContentProps = {
  /** route が受け取った識別子。 */
  id: string;
};

/** 詳細の取得と組み立て。 */
export const NoteDetailPageContent = withScreenSpan(
  "features/notes/detail/page-content",
  async ({ id }: NoteDetailPageContentProps) => {
    const note = await loadNote(id);

    return <NoteDetailView note={note} />;
  },
);
```

```tsx
// src/features/notes/detail/view.tsx
import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/design-system/navigation/breadcrumb/breadcrumb";
import { formatDateTime } from "@/model/datetime";
import type { Note } from "@/model/note/note";
import { withScreenSpan } from "@/observability/render-span";

import { NOTE_LIST_PATH, noteEditPath } from "../paths";

/** `NoteDetailView` の props。 */
export type NoteDetailViewProps = {
  /** 表示するメモ。 */
  note: Note;
};

/** メモ 1 件の詳細。見出しはパンくずの現在地が担う。 */
export const NoteDetailView = withScreenSpan(
  "features/notes/detail/view",
  ({ note }: NoteDetailViewProps) => {
    return (
      <article className="flex flex-col gap-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={NOTE_LIST_PATH}>メモ</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{note.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl font-emphasis">{note.title}</h1>
        <p className="text-sm text-muted-foreground">
          最終更新 <time dateTime={note.updatedAt.toISOString()}>{formatDateTime(note.updatedAt)}</time>
        </p>
        <p className="whitespace-pre-wrap">{note.body}</p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href={noteEditPath(note.id)}>編集する</Link>
          </Button>
          <Button asChild variant={BUTTON_VARIANT.OUTLINE}>
            <Link href={NOTE_LIST_PATH}>一覧へ戻る</Link>
          </Button>
        </div>
      </article>
    );
  },
);
```

押さえること。

- **画面の最上位は `withScreenSpan`、`ui/` の部品は `withPartSpan`。** 名前は `src/` からのモジュール
  パスと一致させる（[`src/features/README.md`](../../src/features/README.md)「描画を span に載せる」）
- **`view` は取得を持たない。** 取得を持たせると story で描けなくなる。`loading` は route の
  `Suspense` が `skeleton` を出し、`error` は route の `error.tsx` が受けるので、`view` が持つ状態は
  success と empty である
- **文字の重さは `font-emphasis` のような意味の class で書く。** `font-bold` のような生の値は ESLint
  が落とす（[0051](../adr/0051-styling-system.md)）
- **他の feature が使うものが出てきたら `facade/` へ出す。** いまは無いので作らない。「使いそう」で
  先に上げない（[`design/placement.md`](../design/placement.md)「使いそう」で上げると戻らない）

**迷ったら:** 部品を `ui/` に置くか `components` へ上げるかは
[`design/placement.md`](../design/placement.md)「表示（UI）」の分岐。先に効くのは「題材の語彙を
持つか」で、持つものは `components` へ行けない。

**確認:**

```bash
pnpm exec vitest run src/features/notes
pnpm check:architecture            # 層の境界（import の向き）が README の宣言と一致している
```

---

## Step 5 — `app/notes`: route segment と metadata、器、保護

**目的:** URL を画面に結び、metadata を宣言し、器（shell）を据え、認証の内側であることを宣言する。
`page.tsx` は feature を薄く呼ぶだけで、判断を持たない。

**ファイル:**

```text
src/app/notes/
├── layout.tsx              # 器。header / nav / main / footer
├── require-session.ts      # 確定認可。入れない主体をログインへ送る
├── page.tsx                # /notes
└── [id]/
    ├── page.tsx            # /notes/[id]
    ├── not-found.tsx       # 見つからない面
    ├── error.tsx           # 失敗の面
    └── edit/
        └── page.tsx        # /notes/[id]/edit（Step 6）
```

**保護を宣言する。** `src/model/authz.ts` の `ROUTE_POLICIES` に 1 行足す。入口（`src/proxy.ts`）の
前捌きと `robots.txt` はこの宣言から採る。

```ts
const ROUTE_POLICIES: readonly RoutePolicy[] = [
  { prefix: "/account", allowed: AUTHENTICATED_ROLES },
  { prefix: "/admin", allowed: ADMIN_ROLES },
  { prefix: "/notes", allowed: AUTHENTICATED_ROLES },
];
```

**前捌きは防御線ではない。** 確定認可は画面の中で通す。`adapters/server/auth` を引けるのは `app` と
`adapters` だけなので（`architecture.ts` の `RESTRICTED_AREAS`）、判定は feature ではなく `app` 側の
モジュールに置く。

```ts
// src/app/notes/require-session.ts
import { redirect } from "next/navigation";

import { verifySession } from "@/adapters/server/auth/session";
import { loginPath } from "@/features/auth/facade/paths";

/**
 * 認証済みの主体であることを、画面を描く前に確かめる。
 *
 * @remarks
 * 各画面が同じ判定を書き写すと、条件が 1 箇所ずつずれていきます。判定そのものは `adapters` が持ち、
 * ここが持つのは入れなかった主体をどこへ送るかだけです。
 *
 * @param returnTo - 認証を終えた利用者を戻す先
 */
export async function requireSession(returnTo: string): Promise<void> {
  if ((await verifySession()) === null) {
    redirect(loginPath(returnTo));
  }
}
```

```tsx
// src/app/notes/layout.tsx
import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell/app-shell";
import { NOTE_LIST_PATH } from "@/features/notes/paths";

import { SITE_NAME } from "../site";

const NAV_ITEMS = [{ href: NOTE_LIST_PATH, label: "メモ" }];

/**
 * メモの画面の外枠。
 *
 * @remarks
 * root layout は `html` / `body` と Provider の mount だけを持つので、header と nav はここで据えます。
 * 同じ器を別の segment も使うようになったら、route group に昇格させます。
 *
 * この器自身は何も取得しません。主体を知らないと決まらない導線は `navSlot` へ `Suspense` で渡します。
 */
export default function NotesLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell navItems={NAV_ITEMS} siteName={SITE_NAME}>
      {children}
    </AppShell>
  );
}
```

```tsx
// src/app/notes/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { NoteListPageContent } from "@/features/notes/list/page-content";
import { NoteListSkeleton } from "@/features/notes/list/ui/skeleton/skeleton";
import { NOTE_LIST_PATH } from "@/features/notes/paths";

import { requireSession } from "./require-session";

export const metadata: Metadata = {
  title: "メモ",
  description: "自分のメモの一覧です。",
  robots: { index: false, follow: false },
};

/**
 * 一覧の中身。
 *
 * @remarks
 * **取得と判定を解くのはここです。** 器の側で待つと、待っている間は殻すら配れません。
 */
async function NoteListContent() {
  await requireSession(NOTE_LIST_PATH);

  return <NoteListPageContent />;
}

/** メモの一覧。 */
export default function NotesPage() {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>メモ</PageHeaderTitle>
          <PageHeaderDescription>更新の新しい順に並んでいます。</PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<NoteListSkeleton />}>
        <NoteListContent />
      </Suspense>
    </ContentContainer>
  );
}
```

```tsx
// src/app/notes/[id]/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import { NoteDetailPageContent } from "@/features/notes/detail/page-content";
import { NoteListSkeleton } from "@/features/notes/list/ui/skeleton/skeleton";
import { noteDetailPath } from "@/features/notes/paths";

import { requireSession } from "../require-session";

export const metadata: Metadata = {
  title: "メモの詳細",
  robots: { index: false, follow: false },
};

/**
 * 詳細の中身。
 *
 * @remarks
 * **存在しないメモでも 200 が返ります。** 殻を先に流すため、`notFound()` に達した時点で応答の
 * ヘッダは出ています。見つからないことは画面（`not-found.tsx`）と `noindex` が伝えます。
 */
async function NoteDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await requireSession(noteDetailPath(id));

  return <NoteDetailPageContent id={id} />;
}

/** メモの詳細。見出しは feature 側の `view` が持つ。 */
export default function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ContentContainer className="py-8">
      <Suspense fallback={<NoteListSkeleton />}>
        <NoteDetailContent params={params} />
      </Suspense>
    </ContentContainer>
  );
}
```

```tsx
// src/app/notes/[id]/not-found.tsx
import Link from "next/link";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";
import { NOTE_LIST_PATH } from "@/features/notes/paths";

/** 見つからない面。文言は分類ごとに `errors` が持つので、ここで組み立てない。 */
export default function NoteDetailNotFound() {
  return (
    <ContentContainer className="flex flex-col items-start gap-4 py-8">
      <h1 className="text-xl font-emphasis">{getDefaultErrorMeta(ErrorKind.NOT_FOUND).message}</h1>
      <Link className="underline" href={NOTE_LIST_PATH}>
        一覧へ戻る
      </Link>
    </ContentContainer>
  );
}
```

```tsx
// src/app/notes/[id]/error.tsx
"use client";

import { Button } from "@/components/design-system/action/button/button";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";

/**
 * 失敗の面。
 *
 * @remarks
 * 文言はここで組み立てません。production では Server Component から投げられたエラーの本文が
 * 伏せられ、境界には `digest` しか渡らないためです。
 */
export default function NoteDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ContentContainer className="flex flex-col items-start gap-4 py-8">
      <h1 className="text-xl font-emphasis">{getDefaultErrorMeta(ErrorKind.INTERNAL).message}</h1>
      {error.digest === undefined ? null : (
        <p className="text-sm text-muted-foreground">問い合わせ ID: {error.digest}</p>
      )}
      <Button onClick={reset} type="button">
        もう一度読み込む
      </Button>
    </ContentContainer>
  );
}
```

押さえること。

- **`params` / `searchParams` は穴の内側で解く。** 器で `await` すると殻を配れない
  （[0041](../adr/0041-cache-components-decision.md)）。描くモードを `dynamic` などの segment config で
  宣言しない。殻を配れない画面だけが `export const instant = false` を理由つきで名乗る
- **認証の要る画面は `robots: { index: false, follow: false }` を置く。** 索引させる環境でも隠す。
  誰でも開ける画面なら代わりに `alternates.canonical` を置き、`src/app/sitemap.ts` の `PUBLIC_PATHS`
  に載せる（[`src/app/README.md`](../../src/app/README.md)「metadata の土台と差分」）
- **動的セグメントの画面で中身に応じた `title` を出すなら `generateMetadata`。** 判定は feature 側の
  module に置き、page は `params` を解いて渡すだけにする。取得は Step 3 の `cache()` が 1 回に
  まとめる（[0044](../adr/0044-seo-metadata-strategy.md)）
- **横断 UI と Provider を mount してよいのは `layout.tsx` だけ**（[0026](../adr/0026-layout-shell-mount.md)）

**迷ったら:** 殻を配れるか、待ちの境界をどこに置くか、失敗と不在の面をどう分けるかは画面ごとの判断で、
答えを書く場所は [`src/app/README.md`](../../src/app/README.md)「この層が持つ判断」の表にある。

**確認:** 開発サーバで実際に開く。session は `/dev/session` で発行する。

```bash
APP_API_MODE=mock pnpm dev
# 別の端末で
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/notes
# → 307 http://localhost:3000/login?returnUrl=%2Fnotes（未認証は入口で送り返される）
```

ブラウザで `http://localhost:3000/dev/session` を開いて `user` の session を発行し、`/notes` →
詳細 → 存在しない ID（`/notes/00000000-0000-7000-8000-000000000000`）の順に開く。モックはどの ID にも
応えるので、見つからない面は Step 7 のテストで確かめる。

build の成果物と描画の宣言の突合は、build のあとに回す。

```bash
APP_API_MODE=mock pnpm build && pnpm render-mode
```

---

## Step 6 — 送信: Server Action と結果の見せ方

**目的:** 編集画面を作り、`<form action>` → Server Action → `ActionState` → 画面の往復を通す。
**Server Action は編成だけを持ち、解くことと分類することを隣へ出す**。

**ファイル（Step 4 の木に足す）:**

```text
src/features/notes/
├── actions.ts                      # 保存の Server Action
├── form-names.ts                   # FormData の項目名。送る側と読む側が同じ綴りを引く
├── form-state.ts                   # 戻り値の型と、この画面でしか言えない文言
├── parse-note-form.ts              # FormData を解く。表示検証を通し直す
├── __mocks__/actions.ts            # カタログでの差し替え
└── edit/
    ├── page-content.tsx
    ├── view.tsx
    └── ui/note-form/note-form.tsx  # client island
src/app/notes/[id]/edit/page.tsx
```

```ts
// src/features/notes/form-names.ts
import type { NoteField } from "@/model/note/note-schema";

/** 入力欄の `name`。項目の集合とスキーマの項目を `satisfies` で突き合わせる。 */
export const NOTE_FIELD_NAMES = {
  title: "title",
  body: "body",
} as const satisfies Readonly<Record<NoteField, string>>;

/** 対象を指す hidden の `name`。 */
export const NOTE_ID_FIELD = "noteId";
```

```ts
// src/features/notes/form-state.ts
import type { ActionState } from "@/model/action-state";
import type { NoteField } from "@/model/note/note-schema";

/**
 * 保存の結果。
 *
 * @remarks
 * 成功値を持ちません。保存後の内容は画面が取り直すので、結果に載せて運ぶものがありません
 * （`ActionState` は `useActionState` の境界を越えて直列化されるため、`Date` を持つ `Note` は
 * 載せられません）。
 */
export type NoteFormState = ActionState<undefined, NoteField>;

/** 対象が送られてこなかったときの文言。 */
export const TARGET_LOST_MESSAGE = "対象のメモが判りません。画面を開き直してください。";

/** 入力が表示検証を通らなかったときの、フォーム全体の文言。項目ごとの文言はスキーマが持つ。 */
export const INVALID_INPUT_MESSAGE = "入力内容を確認してください。";

/**
 * 他の場所で先に更新されていたときの文言。
 *
 * @remarks
 * カタログの既定文言は分類だけを伝えるもので、拒まれた理由を言えるのはこの画面だけです。
 */
export const CONFLICT_MESSAGE = "他の場所で先に更新されています。読み込み直してから、もう一度保存してください。";
```

```ts
// src/features/notes/parse-note-form.ts
import { z } from "zod";

import type { FieldErrors } from "@/model/action-state";
import { type NoteField, type NoteInput, noteSchema } from "@/model/note/note-schema";

import { NOTE_FIELD_NAMES } from "./form-names";

/** {@link parseNoteForm} の結果。 */
export type NoteFormParseResult =
  | { readonly ok: true; readonly input: NoteInput }
  | { readonly ok: false; readonly fieldErrors: FieldErrors<NoteField> };

/** `FormData` の 1 項目を文字列として読む。未入力と欠落を同じ空文字へ均す。 */
function readField(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

/**
 * 送信された `FormData` を、保存に渡せる形へ解く。
 *
 * @remarks
 * 検証は client と同じスキーマで通し直します。client の検証は即時に返すためのもので、そこを
 * 通ったことは何の保証にもなりません。
 */
export function parseNoteForm(formData: FormData): NoteFormParseResult {
  const parsed = noteSchema.safeParse({
    title: readField(formData, NOTE_FIELD_NAMES.title),
    body: readField(formData, NOTE_FIELD_NAMES.body),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  return { ok: true, input: parsed.data };
}
```

```ts
// src/features/notes/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { updateMyNote } from "@/adapters/server/api/notes";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import {
  actionStateFromError,
  failedActionState,
  succeededActionState,
} from "@/model/action-state";
import { toNoteId } from "@/model/note/note";

import { NOTE_ID_FIELD } from "./form-names";
import {
  CONFLICT_MESSAGE,
  INVALID_INPUT_MESSAGE,
  type NoteFormState,
  TARGET_LOST_MESSAGE,
} from "./form-state";
import { parseNoteForm } from "./parse-note-form";
import { NOTE_LIST_PATH, noteDetailPath } from "./paths";

/** 送信から対象のメモを取り出す。載っていなければ null。 */
function readNoteId(formData: FormData): string | null {
  const id = formData.get(NOTE_ID_FIELD);

  return typeof id === "string" && id !== "" ? id : null;
}

/**
 * メモを保存する。
 *
 * @remarks
 * 主体を断言しません。契約が本人のメモだけを対象とし、他人のメモは存在ごと秘匿するため、この
 * 操作で他人のメモへ届く経路がありません。
 *
 * **成立したら詳細と一覧を取り直させます。** 画面に留まる保存なので、進んだあとの内容は同じ画面が
 * 出し直し、題名は一覧にも出ます。
 *
 * `409` にだけ専用の文言と `kind` を当てます。画面は `kind` で読み込み直す導線を出し分けます。
 */
export async function updateNoteAction(
  _previous: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const id = readNoteId(formData);

  if (id === null) {
    return failedActionState({ formError: TARGET_LOST_MESSAGE });
  }

  const parsed = parseNoteForm(formData);

  if (!parsed.ok) {
    return failedActionState({ formError: INVALID_INPUT_MESSAGE, fieldErrors: parsed.fieldErrors });
  }

  try {
    await updateMyNote(toNoteId(id), parsed.input);
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.CONFLICT) {
      return failedActionState({ formError: CONFLICT_MESSAGE, kind: ErrorKind.CONFLICT });
    }

    return actionStateFromError(error);
  }

  revalidatePath(noteDetailPath(id));
  revalidatePath(NOTE_LIST_PATH);

  return succeededActionState(undefined);
}
```

```tsx
// src/features/notes/edit/page-content.tsx
import { withScreenSpan } from "@/observability/render-span";

import { loadNote } from "../load-note";
import { NoteEditView } from "./view";

/** `NoteEditPageContent` の props。 */
export type NoteEditPageContentProps = {
  /** route が受け取った識別子。 */
  id: string;
};

/** 編集の取得と組み立て。詳細と同じ口で引くので、同じ描画の中では 1 往復にまとまる。 */
export const NoteEditPageContent = withScreenSpan(
  "features/notes/edit/page-content",
  async ({ id }: NoteEditPageContentProps) => {
    const note = await loadNote(id);

    return <NoteEditView note={note} />;
  },
);
```

```tsx
// src/features/notes/edit/view.tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/design-system/navigation/breadcrumb/breadcrumb";
import type { Note } from "@/model/note/note";
import { withScreenSpan } from "@/observability/render-span";

import { NOTE_LIST_PATH, noteDetailPath } from "../paths";
import { NoteForm } from "./ui/note-form/note-form";

/** `NoteEditView` の props。 */
export type NoteEditViewProps = {
  /** 編集するメモ。入力欄の初期値になる。 */
  note: Note;
};

/** 編集の画面。パンくずと form を組む。 */
export const NoteEditView = withScreenSpan(
  "features/notes/edit/view",
  ({ note }: NoteEditViewProps) => {
    return (
      <div className="flex flex-col gap-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={NOTE_LIST_PATH}>メモ</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={noteDetailPath(note.id)}>{note.title}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>編集</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <NoteForm note={note} />
      </div>
    );
  },
);
```

```tsx
// src/features/notes/edit/ui/note-form/note-form.tsx
"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { FormFeedback } from "@/components/app-starter/form-feedback/form-feedback";
import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { Input } from "@/components/design-system/form/input/input";
import { Textarea } from "@/components/design-system/form/textarea/textarea";
import { FormField } from "@/components/patterns/form-field/form-field";
import { useToast } from "@/components/shell/toaster/toaster";
import { ErrorKind } from "@/errors/error-kind";
import { idleActionState } from "@/model/action-state";
import type { Note } from "@/model/note/note";
import { isRequiredNoteField } from "@/model/note/note-schema";

import { updateNoteAction } from "../../../actions";
import { NOTE_FIELD_NAMES, NOTE_ID_FIELD } from "../../../form-names";
import type { NoteFormState } from "../../../form-state";
import { noteEditPath } from "../../../paths";

/** `NoteForm` の props。 */
export type NoteFormProps = {
  /** 編集するメモ。 */
  note: Note;
};

/**
 * 送信ボタン。
 *
 * @remarks
 * `useFormStatus` は `form` の子でしか送信状態を読めないため、別の部品に切り出しています。
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button pending={pending} pendingLabel="保存しています…" type="submit">
      保存する
    </Button>
  );
}

/**
 * メモの編集フォーム。
 *
 * @remarks
 * 値は画面が持ちます（制御欄）。`<form action>` は action が終わると失敗でも `form.reset()` を呼ぶので、
 * 非制御の欄では弾かれた送信のあとに書いた内容が失われます。
 *
 * 成功は toast で伝えます。画面を移さない保存なので、この場に留まる通知が合います。
 */
export function NoteForm({ note }: NoteFormProps) {
  const [state, formAction] = useActionState<NoteFormState, FormData>(
    updateNoteAction,
    idleActionState(),
  );
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const id = useId();
  const { toast } = useToast();

  useEffect(() => {
    if (state.status === "success") {
      toast({ title: "メモを保存しました" });
    }
  }, [state, toast]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {state.status === "error" && state.formError !== null ? (
        <FormFeedback description={state.formError} title="保存できませんでした" variant="destructive">
          {state.kind === ErrorKind.CONFLICT ? (
            <Button asChild size="sm" variant={BUTTON_VARIANT.OUTLINE}>
              <Link href={noteEditPath(note.id)}>読み込み直す</Link>
            </Button>
          ) : null}
        </FormFeedback>
      ) : null}
      <input name={NOTE_ID_FIELD} type="hidden" value={note.id} />
      <FormField
        controlId={`${id}-title`}
        label="題名"
        message={fieldErrors?.title?.[0]}
        required={isRequiredNoteField("title")}
      >
        {(control) => (
          <Input
            {...control}
            name={NOTE_FIELD_NAMES.title}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        )}
      </FormField>
      <FormField
        controlId={`${id}-body`}
        label="本文"
        message={fieldErrors?.body?.[0]}
        required={isRequiredNoteField("body")}
      >
        {(control) => (
          <Textarea
            {...control}
            name={NOTE_FIELD_NAMES.body}
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            value={body}
          />
        )}
      </FormField>
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
```

```ts
// src/features/notes/__mocks__/actions.ts
import { fn } from "storybook/test";

import { succeededActionState } from "@/model/action-state";

import type { NoteFormState } from "../form-state";

/**
 * カタログでの `updateNoteAction`。
 *
 * @remarks
 * 本物は成立すると画面を取り直しますが、カタログには取り直す先が無いので、成功を返してその場に
 * 留まります。
 */
export const updateNoteAction = fn(
  async (): Promise<NoteFormState> => succeededActionState(undefined),
).mockName("updateNoteAction");
```

差し替えの宣言を `.storybook/preview.tsx` に 1 行足す。載せないと、カタログで押した先で `config` の
読み込みに落ちる。

```ts
sb.mock(import("../src/features/notes/actions.ts"));
```

`__mocks__/` はカバレッジの母数から外す。`scripts/lib/untested-modules.ts` の `CATALOG_MOCK_MODULES` に
`src/features/notes/__mocks__/**` を足し、同じパターンを `src/features/notes/README.md` の frontmatter
`coverage-exclusions` にも書く（Step 9）。

```tsx
// src/app/notes/[id]/edit/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { NoteEditPageContent } from "@/features/notes/edit/page-content";
import { NoteListSkeleton } from "@/features/notes/list/ui/skeleton/skeleton";
import { noteEditPath } from "@/features/notes/paths";

import { requireSession } from "../../require-session";

export const metadata: Metadata = {
  title: "メモの編集",
  robots: { index: false, follow: false },
};

async function NoteEditContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await requireSession(noteEditPath(id));

  return <NoteEditPageContent id={id} />;
}

/**
 * メモの編集。
 *
 * @remarks
 * 詳細とは独立した route です。1 つの画面に表示と編集を同居させると、どちらの状態で開いているかが
 * URL から失われ、戻る操作も共有もできなくなります。
 */
export default function NoteEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>メモの編集</PageHeaderTitle>
          <PageHeaderDescription>題名と本文を変更できます。</PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<NoteListSkeleton />}>
        <NoteEditContent params={params} />
      </Suspense>
    </ContentContainer>
  );
}
```

押さえること。

- **検証は 3 回起きる。** 送る前（ブラウザ。この文書では省いている）、Server Action の中
  （`parseNoteForm` が同じスキーマを通し直す。これが正）、`adapters` の契約検証（生成スキーマ）。
  役割が違うので省けない（[0062](../adr/0062-form-input-validation.md)）
- **失敗は戻り値で返す。** `redirect()` だけが throw で、それは成立の合図である。`revalidatePath` と
  `redirect()` は `try` の**外**に置く（[`design/forms.md`](../design/forms.md)「間違えやすいところ」）
- **出し分けの合図は `kind` であって文言ではない。** 読み込み直す導線は `state.kind === ErrorKind.CONFLICT`
  で判定する。文言を合図にすると、文言を直した瞬間に導線が黙って消える
- **Server Action は公開 HTTP の口である。** 画面が保護されていても action は保護されない。この action
  が主体を断言しないで済むのは、契約が本人のメモしか対象にしないからで、**主体の断言が要る action は
  `app/**/actions.ts` に置く**（`features` から `adapters/server/auth` へ届かない。
  [0025](../adr/0025-app-layer-elements.md)）

**迷ったら:** 入力の値を誰が持つか（ボタンと hidden だけ / react-hook-form / `useState`）、
結果を inline・toast・redirect のどれで見せるかは [`design/forms.md`](../design/forms.md) が
分岐を持ち、判断は [0061](../adr/0061-form-mutation-ux.md) /
[0063](../adr/0063-mutation-result-notification.md)。確認 dialog を挟む基準は
[`rules.md`](../rules.md)「フォームと送信」。

**確認:**

```bash
pnpm exec vitest run src/features/notes/actions.test.ts src/features/notes/parse-note-form.test.ts
```

開発サーバで `/notes/<id>/edit` を開き、題名を空にして保存する。項目の下に「題名を入力してください。」が
出て、入力欄の中身が消えないことを見る。

---

## Step 7 — テスト: 何をどこで見るか

**目的:** 各層が負う責務だけを、その層の隣で確かめる。**同じことを 2 つの層で見ない。**

何をどこで見るかは [0090](../adr/0090-testing-strategy.md) の層別責務表が決め、各ディレクトリの
README の frontmatter `test-requirement` がどの行に当たるかを宣言している。この feature で書くテストは
次のとおり。

| 対象 | 責務 | 見るもの | 見ないもの |
| --- | --- | --- | --- |
| `model/note/*.test.ts` | `unit` | brand の付与、必須判定、表示検証の文言 | 契約の形 |
| `adapters/server/api/notes.test.ts` | `integration` | MSW で止めた HTTP 境界。URL・ヘッダ・本文・変換・分類 | 画面 |
| `features/notes/load-note.test.ts` | `unit` | `not-found` だけが `notFound()` へ行き、他は投げ直すこと | HTTP |
| `features/notes/**/*.test.tsx` | `feature` | 描画結果と a11y。`page-content` は `render(await Component(props))` | HTTP（adapter を `vi.mock`） |
| `features/notes/actions.test.ts` | `unit` | 返した `ActionState` の分類、成立時の再検証 | HTTP |
| `app/notes/require-session.test.ts` | `unit` | 未認証がログインへ、認証済みは素通り | session の復元 |

**`export` と `describe` は 1:1 に対応させる。** `scripts/one-to-one.gate.test.ts` が全 `export` に
同名の `describe` を要求する。`page.tsx` は対象外（`scripts/lib/untested-modules.ts` の宣言）。

```ts
// src/adapters/server/api/notes.test.ts
import { describe, expect, it, vi } from "vitest";

import { PARSED_ENVIRONMENT } from "@/config/environment.fixture";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { toNoteId } from "@/model/note/note";
import { serveJson, serveStatus, serveWrite } from "../../../../vitest.setup.msw";

const { getAccessToken, getEnvironment } = vi.hoisted(() => ({
  getAccessToken: vi.fn(async (): Promise<string | null> => "access-token"),
  getEnvironment: vi.fn(() => PARSED_ENVIRONMENT),
}));

vi.mock("@/config/environment", () => ({ getEnvironment }));
vi.mock("../auth/session", () => ({ getAccessToken }));

import { getMyNote, getMyNotes, updateMyNote } from "./notes";

const NOTES_URL = `${PARSED_ENVIRONMENT.APP_API_BASE_URL}/v1/notes`;
const NOTE_URL = `${NOTES_URL}/:noteId`;

const wireNote = {
  id: "0195f0c2-0000-7000-8000-000000000001",
  title: "打ち合わせの覚え書き",
  body: "次回までに確かめること。",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

/** 投げられたエラーに付いた分類を返す。投げなければ undefined。 */
async function kindOf(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    return findAppError(error)?.kind;
  }

  return undefined;
}

describe("getMyNotes", () => {
  // ----- 正常系 -----
  it("契約の 1 件を表示用の 3 項目へ写す", async () => {
    serveJson(NOTES_URL, { items: [wireNote], nextCursor: null });

    const page = await getMyNotes();

    expect(page.items[0]).toEqual({
      id: wireNote.id,
      title: wireNote.title,
      updatedAt: new Date(wireNote.updatedAt),
    });
  });

  it("件数をクエリへ載せ、認証ヘッダを付けて送る", async () => {
    const requests = serveJson(NOTES_URL, { items: [], nextCursor: null });

    await getMyNotes();

    expect(requests[0]?.url).toBe(`${NOTES_URL}?first=20`);
    expect(requests[0]?.headers.get("Authorization")).toBe("Bearer access-token");
  });

  it("次ページのカーソルを引き継ぐ", async () => {
    serveJson(NOTES_URL, { items: [wireNote], nextCursor: "next" });

    await expect(getMyNotes()).resolves.toMatchObject({ nextCursor: "next" });
  });

  // ----- 異常系 -----
  it("認証できないとき取得へ出さず未認証として投げる", async () => {
    const requests = serveJson(NOTES_URL, { items: [], nextCursor: null });
    getAccessToken.mockResolvedValueOnce(null);

    await expect(kindOf(() => getMyNotes())).resolves.toBe(ErrorKind.UNAUTHENTICATED);
    expect(requests).toHaveLength(0);
  });
});

describe("getMyNote", () => {
  // ----- 正常系 -----
  it("本文まで含めて表示用の型へ写す", async () => {
    serveJson(NOTE_URL, wireNote);

    await expect(getMyNote(toNoteId(wireNote.id))).resolves.toMatchObject({
      body: wireNote.body,
      updatedAt: new Date(wireNote.updatedAt),
    });
  });

  // ----- 異常系 -----
  it("404 を not-found の分類で投げる", async () => {
    serveStatus("get", NOTE_URL, 404);

    await expect(kindOf(() => getMyNote(toNoteId(wireNote.id)))).resolves.toBe(
      ErrorKind.NOT_FOUND,
    );
  });
});

describe("updateMyNote", () => {
  // ----- 正常系 -----
  it("題名と本文を PATCH の本文で送る", async () => {
    const requests = serveWrite("patch", NOTE_URL, wireNote);

    await updateMyNote(toNoteId(wireNote.id), { title: "題名", body: "本文" });

    await expect(requests[0]?.json()).resolves.toEqual({ title: "題名", body: "本文" });
  });

  // ----- 異常系 -----
  it("409 を conflict の分類で投げる", async () => {
    serveStatus("patch", NOTE_URL, 409);

    await expect(
      kindOf(() => updateMyNote(toNoteId(wireNote.id), { title: "題名", body: "本文" })),
    ).resolves.toBe(ErrorKind.CONFLICT);
  });
});
```

```ts
// src/features/notes/load-note.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppError, findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";

const { getMyNote, notFound } = vi.hoisted(() => ({
  getMyNote: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/adapters/server/api/notes", () => ({ getMyNote }));
vi.mock("next/navigation", () => ({ notFound }));

import { NOTE } from "./note.fixture";
import { loadNote } from "./load-note";

beforeEach(() => {
  vi.clearAllMocks();
  getMyNote.mockResolvedValue(NOTE);
});

describe("loadNote", () => {
  // ----- 正常系 -----
  it("受け取った識別子でメモを引く", async () => {
    await expect(loadNote(NOTE.id)).resolves.toBe(NOTE);
    expect(getMyNote).toHaveBeenCalledWith(NOTE.id);
  });

  // ----- 異常系 -----
  it("見つからないメモは not-found の境界へ渡す", async () => {
    getMyNote.mockRejectedValue(createAppError(ErrorKind.NOT_FOUND));

    await expect(loadNote("無い")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("見つからない以外の失敗は分類のまま投げ直す", async () => {
    getMyNote.mockRejectedValue(createAppError(ErrorKind.UNAVAILABLE));

    await expect(loadNote(NOTE.id)).rejects.toSatisfy(
      (error: unknown) => findAppError(error)?.kind === ErrorKind.UNAVAILABLE,
    );
    expect(notFound).not.toHaveBeenCalled();
  });
});
```

```ts
// src/features/notes/actions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppError } from "@/errors/app-error";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";
import { idleActionState } from "@/model/action-state";

const { updateMyNote, revalidatePath } = vi.hoisted(() => ({
  updateMyNote: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/adapters/server/api/notes", () => ({ updateMyNote }));

import { updateNoteAction } from "./actions";
import { CONFLICT_MESSAGE, INVALID_INPUT_MESSAGE, TARGET_LOST_MESSAGE } from "./form-state";

const NOTE_ID = "0195f0c2-0000-7000-8000-000000000001";

/** 形の上で通る最小の入力。 */
function noteForm(fields: Record<string, string> = {}): FormData {
  const form = new FormData();

  for (const [name, value] of Object.entries({ noteId: NOTE_ID, title: "題名", body: "本文", ...fields })) {
    if (value !== "") form.append(name, value);
  }

  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateNoteAction", () => {
  // ----- 正常系 -----
  it("解いた題名と本文で保存する", async () => {
    await updateNoteAction(idleActionState(), noteForm());

    expect(updateMyNote).toHaveBeenCalledWith(NOTE_ID, { title: "題名", body: "本文" });
  });

  it("成立したら、詳細と一覧を取り直させる", async () => {
    const state = await updateNoteAction(idleActionState(), noteForm());

    expect(state.status).toBe("success");
    expect(revalidatePath).toHaveBeenCalledWith(`/notes/${NOTE_ID}`);
    expect(revalidatePath).toHaveBeenCalledWith("/notes");
  });

  // ----- 異常系 -----
  it("対象が送られてこなければ、保存を試みない", async () => {
    const state = await updateNoteAction(idleActionState(), noteForm({ noteId: "" }));

    expect(state).toMatchObject({ status: "error", formError: TARGET_LOST_MESSAGE });
    expect(updateMyNote).not.toHaveBeenCalled();
  });

  it("題名が空なら、項目の文言を付けて返し、保存を試みない", async () => {
    const state = await updateNoteAction(idleActionState(), noteForm({ title: "" }));

    expect(state).toMatchObject({
      status: "error",
      formError: INVALID_INPUT_MESSAGE,
      fieldErrors: { title: ["題名を入力してください。"] },
    });
    expect(updateMyNote).not.toHaveBeenCalled();
  });

  it("先に更新されていたことを、専用の文言と分類で伝える", async () => {
    updateMyNote.mockRejectedValueOnce(createAppError(ErrorKind.CONFLICT));

    const state = await updateNoteAction(idleActionState(), noteForm());

    expect(state).toMatchObject({
      status: "error",
      formError: CONFLICT_MESSAGE,
      kind: ErrorKind.CONFLICT,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("それ以外の失敗は分類ごとの既定の文言で伝える", async () => {
    updateMyNote.mockRejectedValueOnce(createAppError(ErrorKind.UNAVAILABLE));

    const state = await updateNoteAction(idleActionState(), noteForm());

    expect(state).toMatchObject({
      status: "error",
      kind: ErrorKind.UNAVAILABLE,
      formError: getDefaultErrorMeta(ErrorKind.UNAVAILABLE).message,
    });
  });
});
```

```tsx
// src/features/notes/list/ui/note-list/note-list.test.tsx
// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { NOTES } from "../../../note.fixture";
import { NoteList } from "./note-list";

describe("NoteList", () => {
  it("行そのものを詳細への行き先にする", () => {
    render(<NoteList notes={NOTES} />);

    expect(screen.getByRole("link", { name: new RegExp(NOTES[0].title) })).toHaveAttribute(
      "href",
      `/notes/${NOTES[0].id}`,
    );
  });

  it("受け取った件数だけ行を出す", () => {
    render(<NoteList notes={NOTES} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(NOTES.length);
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<NoteList notes={NOTES} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
```

押さえること。

- **最上位の `describe` は export された記号の名前**、`it` は日本語で振る舞いを書く。値を返す対象は
  `// ----- 正常系 -----` / `// ----- 異常系 -----` で割り、描画を返す対象は割らない
- **HTTP は MSW で止める。** `fetch` の手書きスタブや adapter のモジュール mock で代替しない。MSW を
  立てるのは `vitest.setup.msw.ts` を import したファイルだけ
- **async RSC は `render(await Component(props))` で描く。** サーバランタイムを模した mock を積まない
  （[0091](../adr/0091-test-verification-methods.md)）
- **カバレッジは 4 指標 100% が gate**なので、カバレッジは「意味を持つか」について何も語らない。
  分岐ごとに固有の結果を見る（[`testing-conventions.md`](../testing-conventions.md)「意味網羅」）

**迷ったら:** アサーションの強さ、Testing Library の原則、jsdom に無い API の扱いは
[`testing-conventions.md`](../testing-conventions.md)。

**確認:** 書いたファイルだけを回す。全体のゲートは hook と CI が回すので、先回りしない。

```bash
pnpm exec vitest run src/model/note src/adapters/server/api/notes.test.ts src/features/notes src/app/notes
pnpm exec vitest run --config vitest.scripts.config.ts scripts/one-to-one.gate.test.ts scripts/test-requirement.gate.test.ts
```

---

## Step 8 — カタログと基準画像

**目的:** 画面と部品の見た目を story として固定し、基準画像で守る。**`ui/` の部品はすべて自分の
story を持つ**。

**story の `title`:** 画面の合成は `Page/<feature>/<画面>`、画面固有の部品は
`Features/<feature>/<画面>/<部品>`。体系は [`src/components/README.md`](../../src/components/README.md)
が持つ。

```ts
// src/features/notes/note.fixture.ts
import { toNoteId } from "@/model/note/note";
import type { Note, NoteSummary } from "@/model/note/note";

/** story とテストが読む固定のメモ。 */
export const NOTE: Note = {
  id: toNoteId("0195f0c2-0000-7000-8000-000000000001"),
  title: "打ち合わせの覚え書き",
  body: "次回までに確かめること。\n\n- 前提の整理\n- 担当の確認",
  updatedAt: new Date("2026-09-01T09:30:00+09:00"),
};

/** 一覧に並べる固定のメモ。長い題名と短い題名を混ぜ、折り返しの挙動が出るようにする。 */
export const NOTES: readonly NoteSummary[] = [
  NOTE,
  {
    id: toNoteId("0195f0c2-0000-7000-8000-000000000002"),
    title: "区切りの無い長い題名をひとつ置いて折り返しの見え方をこの行で確かめるためのメモ",
    updatedAt: new Date("2026-08-28T18:00:00+09:00"),
  },
  {
    id: toNoteId("0195f0c2-0000-7000-8000-000000000003"),
    title: "短い",
    updatedAt: new Date("2026-08-01T00:00:00+09:00"),
  },
];
```

```tsx
// src/features/notes/list/view.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { NOTES } from "../note.fixture";
import { NoteListView } from "./view";

const meta = {
  title: "Page/Notes/List",
  component: NoteListView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "メモの一覧です。題名と更新日時を並べ、行そのものが詳細への行き先になります。",
      },
    },
  },
} satisfies Meta<typeof NoteListView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。 */
export const Default: Story = {
  args: { notes: NOTES },
};

/** 1 件も無い。 */
export const Empty: Story = {
  args: { notes: [] },
};
```

```tsx
// src/features/notes/edit/ui/note-form/note-form.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ToastProvider } from "@/components/shell/toaster/toaster";

import { NOTE } from "../../../note.fixture";
import { NoteForm } from "./note-form";

const meta = {
  title: "Features/Notes/Edit/NoteForm",
  component: NoteForm,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "メモの編集フォームです。送信先はカタログでは差し替えられ、成功を返してその場に留まります。",
      },
    },
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof NoteForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。 */
export const Default: Story = {
  args: { note: NOTE },
};
```

`NoteList` / `NoteListEmpty` / `NoteListSkeleton` / `NoteDetailView` / `NoteEditView` にも同じ形で
story を置く。送信中の姿を撮るには、差し替えた action に解決しない送信先
（`~catalog/lib/pending-action` の `neverSettlingAction`）を返させる。書き方は
[`src/features/README.md`](../../src/features/README.md)「カタログに載せる」。

**画面単位の基準画像は、route の宣言で撮る。** `e2e/lib/screens.ts` の `SCREENS` に 3 つ足す。build が
出す route と宣言を突き合わせるので、**宣言の無い route が現れたら落ちる**。

```ts
export const SCREENS: readonly ScreenDeclaration[] = [
  { route: "/", name: "home", path: "/" },
  { route: "/notes", name: "notes", path: "/notes", signedIn: "user" },
  {
    route: "/notes/[id]",
    name: "note-detail",
    // モックは同じ URL へ同じ応答を返すため、ID を固定すれば中身も固定される。
    path: "/notes/0195f0c2-0000-7000-8000-000000000001",
    signedIn: "user",
  },
  {
    route: "/notes/[id]/edit",
    name: "note-edit",
    path: "/notes/0195f0c2-0000-7000-8000-000000000001/edit",
    signedIn: "user",
  },
  // …以下、残っている宣言
];
```

押さえること。

- **story 単位（`vrt/`）と画面単位（`e2e/visual/`）は見ている対象が違う。** 前者は部品を単独で描いた姿、
  後者は部品を組み上げた画面。どちらも基準画像は容器の中でしか撮らない
  （[`vrt/README.md`](../../vrt/README.md) / [`e2e/README.md`](../../e2e/README.md)）
- **意図した変更も、まずは赤くなる。** 撮り直しは PR の `baseline-retake` ラベルが既定の経路で、
  手元から撮って送るのは `make vrt-retake` / `make e2e-retake`。撮る（`*-update`）だけでは親の
  gitlink が古いままになり、手元は通るのに CI だけ落ちる
- **基準画像が主張を守るのは、fixture がその主張の出る値を持つときだけ。** 折り返しを見るなら区切りの
  無い長い語を fixture に混ぜる（[`testing-conventions.md`](../testing-conventions.md)「見た目の主張を
  どこで見るか」）

**迷ったら:** overlay の探し方や docs ページの分け方など、カタログの器に由来する決まりは
[`.storybook/README.md`](../../.storybook/README.md)。

**確認:**

```bash
APP_ENV=local pnpm storybook       # http://localhost:6006 で Page/Notes と Features/Notes を開く
make vrt VRT_ARGS='--grep "Notes"' # story を基準画像と比べる（初回は基準が無いので差分として出る）
make e2e E2E_ONLY=notes,note-detail,note-edit
make vrt-retake VRT_ONLY=<id>,<id> # 基準を置き場へ送る。CI では baseline-retake ラベル
```

---

## Step 9 — 約束を書く: 仕様書と feature README

**目的:** 画面が何を約束しているかを、実装から推定させずに文書へ置く。**仕様書を持たない route が
残るのは埋めるべき穴である**。

**仕様書。** `src/app` の階層をそのまま写す。route group を使っていないので、そのままのパスになる。

```text
docs/spec/route/notes/
├── layout.screen.md               # 器の約束（nav / 脇の領域の有無）
├── page.screen.md                 # /notes の見え方
├── page.function.md               # /notes の機能要件
└── [id]/
    ├── page.screen.md
    ├── page.function.md
    └── edit/
        ├── page.screen.md
        └── page.function.md
```

機能要件と画面要件の振り分けは 1 つの問いで決める——**バックエンドの契約と利用者の目的が同じまま、
その記述だけが違う画面があり得るか。** あり得るなら画面要件、あり得ないなら機能要件
（[`docs/spec/README.md`](../spec/README.md)）。

```markdown
# `/notes/[id]/edit` メモの編集（機能要件）

> 画面要件は [`page.screen.md`](page.screen.md)。

## 主体と所有

**認証の内側にある。** 未認証で開くと、この画面へ戻る指定を伴ってログインへ送る。判定はこの
route が行う（外枠の前捌きは防御線ではない。[0079](../../../../../adr/0079-auth-frontend-seam.md)）。

返るのは認証主体本人のメモだけで、所有権の絞り込みは契約が持つ。他人のメモも存在しないメモも、
区別なく見つからない扱いになる。

## 取得

`GET /v1/notes/{noteId}` の 1 系統だけ。詳細と同じ口で引く。

## 保存

`PATCH /v1/notes/{noteId}` に題名と本文を絶対値で送る。差分ではないので、再送しても結果は変わらない。

**検証は送る前と受け取った後の両方で、同じ規則を通す。** 題名は必須で 100 文字以内、本文は
2000 文字以内。項目ごとの文言は項目名を主語にする。

**先に更新されていた場合（409）だけ、読み込み直す導線を添える。** 拒まれた理由が「読み込んでからの間に
別の場所で変わった」ことなので、次にすべきなのは押し直しではなく、いまの内容を見ること。

**成立しても画面を移さない。** 詳細と一覧は取り直させ、成立は留まる通知で伝える。

## 失敗

取得の失敗は画面全体に及び、route の失敗の面が受ける。保存の失敗は form の中に出す。
```

`docs/spec/README.md`「いま書いてある画面」の表に 3 行足す。

**feature README。** [`docs/templates/feature-readme.md`](../templates/feature-readme.md) を
`src/features/notes/README.md` へ写して埋める。必須の節は雛形が宣言しており、`readme-review` が
その一覧を読んで採点する。frontmatter には `test-requirement: feature` と、`__mocks__/` の
`coverage-exclusions` を書く。

書くのは **この slice に固有の線引きと、契約・仕様・デザインへの索引だけ**である。層の役割論は
[`src/features/README.md`](../../src/features/README.md) が持ち、画面が何を約束するかは仕様書が持ち、
状態がどう見えるかは story が持つ。同じことを 2 か所へ書くと、片方だけが腐る。

**確認:**

```bash
pnpm lint:md
pnpm exec vitest run --config vitest.scripts.config.ts scripts/doc-links.gate.test.ts
```

---

## 最後に

**commit して、hook と CI に判定させる。** 全体の lint・型検査・テスト・基準画像の比較は pre-commit /
pre-push / CI が回す。手元で同じものをもう一度回しても結果はより正しくならない
（[0151](../adr/0151-git-hooks.md)）。

```bash
git add -A
git commit   # `/commit` skill があれば、それが prefix と分割を決める
```

## まとめ

| Step | 層 | 書いたもの | 押さえたこと | 確認 |
| --- | --- | --- | --- | --- |
| 0 | — | `make setup-remove-sample` | 残る側と消える側の線 | 破棄の連鎖が緑 |
| 1 | 契約 / 生成 | `openapi/sources.yaml` + `make gen-api` | 生成物は編集しない。契約を直して再生成 | `make gen-api-check` |
| 2 | `model` | `note.ts` / `note-schema.ts` | `Date` と brand。表示検証は `zod/mini` | `pnpm exec vitest run src/model/note` |
| 3 | `adapters/server` | `api/notes.ts` | `scope` は口の性質。wire 型はここから出ない | `pnpm exec vitest run …/notes.test.ts` |
| 4 | `features` | `list/` / `detail/` / `paths.ts` / `load-note.ts` | `page-content` と `view` の分離。span の名前 | `pnpm check:architecture` |
| 5 | `app` | `layout.tsx` / `page.tsx` / `require-session.ts` / `authz.ts` | 穴の内側で解く。保護は宣言と確定認可の 2 段 | `pnpm dev` + `curl` / `pnpm render-mode` |
| 6 | 送信 | `actions.ts` + `edit/` | 編成だけ。失敗は戻り値、`kind` で出し分け | `pnpm exec vitest run …/actions.test.ts` |
| 7 | テスト | 各層の隣 | 同じことを 2 層で見ない。1:1 | `pnpm exec vitest run <対象>` |
| 8 | カタログ | `*.stories.tsx` / `e2e/lib/screens.ts` | `ui/` は全部 story を持つ。撮り直しは送るまでが 1 手 | `make vrt` / `make e2e` |
| 9 | 約束 | `docs/spec/route/notes/` / feature README | 仕様書は指すだけで写さない | `pnpm lint:md` |

## 次に進む先

- **雛形に任せる。** `pnpm gen feature <name> --screen=<画面>` が feature の骨組みを（2 画面目は同じコマンドをもう一度）、`pnpm gen adapter <name>` /
  `pnpm gen component <name>` がカーネル側の雛形を出す。この文書は雛形が何を出すべきかの
  根拠であり、出たものを判断する物差しになる。画面を一式作るなら `new-feature` skill が
  [`playbook.md`](../playbook.md) の作業順で進める
- **2 ページ目以降をブラウザで取る。** BFF（`app/api/notes/route.ts`）と `adapters/client/api/notes.ts`
  を足す。経路は [`design/data-fetching.md`](../design/data-fetching.md)「一覧の続きを取る」
- **公開の一覧を作る。** 口を `"public"` にし、`use cache` で要求をまたいで持つ。Step 3 の分岐と
  [`src/adapters/README.md`](../../src/adapters/README.md)
- **入力中の検証を足す。** react-hook-form + `standardSchemaResolver` で同じ `noteSchema` をブラウザ側でも
  通す。配線は [`design/forms.md`](../design/forms.md)「入力の値を誰が持つか」
- **置き場に迷ったら** [`design/placement.md`](../design/placement.md) の 3 つの問いへ戻る

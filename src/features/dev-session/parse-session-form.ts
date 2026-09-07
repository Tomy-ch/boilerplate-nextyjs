import { z } from "zod";

import type { FieldErrors } from "@/model/action-state";
import { SESSION_ROLE, type SessionRole } from "@/model/session";

/** 発行の指定として受け取る項目。 */
export type DevSessionField =
  | "subject"
  | "role"
  | "expiresInSeconds"
  | "accessToken"
  | "issueAccessToken"
  | "issuerUrl";

/** どちらの経路でも要る指定。 */
type DevSessionCommon = {
  readonly subject: string;
  readonly role: SessionRole;
  readonly expiresInSeconds: number;
};

/**
 * 発行する session の指定。
 *
 * @remarks
 * **経路で判別できる union にしてあります。** 取りに行くなら接続先が要り、貼るなら接続先は
 * 要りません。1 つの形へ両方を省略可能として入れると、どちらの組み合わせも型の上では作れて
 * しまい、送信先が中身を見て経路を推し量ることになります。
 */
type DevSessionInput =
  | (DevSessionCommon & {
      readonly issueAccessToken: false;
      /** API へ載せる Bearer。貼らなければ検証されない前提の値が使われる。 */
      readonly accessToken?: string;
    })
  | (DevSessionCommon & {
      readonly issueAccessToken: true;
      /**
       * トークンを取りに行く先。
       *
       * @remarks
       * 設定の `AUTH_ISSUER` を使いません。開発機ではバックエンドを複数の口で並行して立てるため、
       * いま叩いている API が期待する issuer と設定の値がずれます。
       */
      readonly issuer: string;
    });

/** switch が入っているときに `FormData` へ載る値。native の checkbox の既定。 */
const SWITCH_ON = "on";

/** {@link parseDevSessionForm} の結果。 */
export type DevSessionParseResult =
  | { readonly ok: true; readonly input: DevSessionInput }
  | { readonly ok: false; readonly fieldErrors: FieldErrors<DevSessionField> };

/** 失効までの秒数の上限。1 日を超える session を配ると、開発機に長く残り続ける。 */
const MAX_EXPIRES_IN_SECONDS = 86_400;

/**
 * 誰として入るかの長さの上限。
 *
 * @remarks
 * 主体の識別子であって自由入力ではありません。上限が無いと、**封緘した認可コードがそのまま
 * 転送先の URL に載る**ため（認可の往復の途中で送ったとき）、経路上の上限
 * （`NEXT_PUBLIC_HTTP_MAX_URL_BYTES`）を入力しだいで超えられます。
 */
const MAX_SUBJECT_LENGTH = 256;

const devSessionSchema = z.object({
  subject: z
    .string()
    .min(1, "誰として入るかを指定してください。")
    .max(MAX_SUBJECT_LENGTH, `誰として入るかは ${MAX_SUBJECT_LENGTH} 文字以下で指定してください。`),
  role: z.enum([SESSION_ROLE.admin, SESSION_ROLE.user]),
  expiresInSeconds: z.coerce
    .number()
    .int("秒数は整数で指定してください。")
    .positive("秒数は 1 以上で指定してください。")
    .max(MAX_EXPIRES_IN_SECONDS, `秒数は ${MAX_EXPIRES_IN_SECONDS} 以下で指定してください。`),
  accessToken: z.string(),
  issueAccessToken: z.boolean(),
  issuerUrl: z.string(),
});

/**
 * 取りに行くなら接続先が要る、という関係だけを別に見る。
 *
 * @remarks
 * 項目そのものの規則ではなく、**2 つの項目の組み合わせ**の規則です。`issuerUrl` の側に必須を
 * 付けると、取りに行かないときも接続先を求めることになります。
 */
const devSessionRelations = devSessionSchema.superRefine((value, ctx) => {
  if (value.issueAccessToken && !z.url().safeParse(value.issuerUrl).success) {
    ctx.addIssue({
      code: "custom",
      path: ["issuerUrl"],
      message: "接続先を URL で指定してください。",
    });
  }
});

/** `FormData` の 1 項目を文字列として読む。未入力と欠落を同じ空文字へ均す。 */
function readField(formData: FormData, name: DevSessionField): string {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

/**
 * 送信された `FormData` を、発行に渡せる形へ解く。
 *
 * @remarks
 * 貼られたトークンは**形を確かめません**。実物の IdP が出す値の形はこのリポジトリの決め事では
 * ないうえ、確かめたところで受け取る API が拒めば同じ結果になります。空欄は「貼らなかった」で
 * あり、空文字という値ではありません。
 *
 * **取りに行く指定が入っているときは、貼られた値を捨てます。** 入力欄はそのとき画面に出て
 * おらず、残っているのは切り替える前に打った値です。両方を持ち回ると、どちらが効いたのかが
 * 送信した本人にも判らなくなります。逆に、取りに行かないときは接続先を落とします —— 効かない
 * 値を持ち回ると、送信先が「どちらの経路か」を指定の中身から読み取ることになります。
 */
export function parseDevSessionForm(formData: FormData): DevSessionParseResult {
  const issueAccessToken = readField(formData, "issueAccessToken") === SWITCH_ON;
  const parsed = devSessionRelations.safeParse({
    subject: readField(formData, "subject"),
    role: readField(formData, "role"),
    expiresInSeconds: readField(formData, "expiresInSeconds"),
    accessToken: issueAccessToken ? "" : readField(formData, "accessToken"),
    issueAccessToken,
    issuerUrl: readField(formData, "issuerUrl"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { accessToken, issuerUrl, issueAccessToken: _, ...rest } = parsed.data;

  if (issueAccessToken) {
    return { ok: true, input: { ...rest, issueAccessToken: true, issuer: issuerUrl } };
  }

  return {
    ok: true,
    input:
      accessToken === ""
        ? { ...rest, issueAccessToken: false }
        : { ...rest, issueAccessToken: false, accessToken },
  };
}

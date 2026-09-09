"use client";

import { type ChangeEvent, useActionState, useCallback, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { FormFeedback } from "@/components/app-starter/form-feedback/form-feedback";
import { Button } from "@/components/design-system/action/button/button";
import { Input } from "@/components/design-system/form/input/input";
import { Label } from "@/components/design-system/form/label/label";
import {
  RadioGroupNative,
  RadioGroupNativeItem,
} from "@/components/design-system/form/radio-group-native/radio-group-native";
import { SwitchNative } from "@/components/design-system/form/switch-native/switch-native";
import { Textarea } from "@/components/design-system/form/textarea/textarea";
import { FormField } from "@/components/patterns/form-field/form-field";
import { idleActionState } from "@/model/action-state";
import { SESSION_ROLE, type SessionRole } from "@/model/session";

import { AUTHORIZE_ERROR, type AuthorizeError } from "../../authorize-error";
import type { DevSessionFormState, IssueDevSessionAction } from "../../form-state";
import { DEV_AUTHORIZE_PATH, RETURN_URL_PARAM, STATE_PARAM } from "../../paths";

/**
 * 認可の往復の途中で開かれたときに、route segment から渡されるもの。
 *
 * @remarks
 * **1 つに畳んであります。** 対応づける値と理由を別々の nullable で受け取ると、「対応づける値が
 * 無いのに理由だけある」という到達し得ない組み合わせが型として書けます。理由が立つのは
 * 認可 endpoint から戻されたときだけで、そのときは対応づける値も必ず載っています。
 */
export type AuthorizationHandoff = {
  /** 要求と応答を対応づける値。送信へそのまま載せる。 */
  readonly state: string;
  /** 認可を成立させられなかった理由。初めて開いたときは null。 */
  readonly notice: AuthorizeError | null;
};

/** `DevSessionForm` の props。 */
export type DevSessionFormProps = {
  /** 発行したあとの戻り先。 */
  returnUrl: string;
  /**
   * 認可の往復からの引き渡し。直接開いたときは null。
   *
   * @remarks
   * **送信先が変わります。** 入っていれば認可 endpoint（`/dev/session/authorize`）へ素の form で
   * 送り、入っていなければその場で発行する Server Action へ送ります。理由は
   * [`paths.ts`](../../paths.ts) の {@link DEV_AUTHORIZE_PATH} が持ちます。
   */
  authorization: AuthorizationHandoff | null;
  /** 発行の送信先。route が渡す。 */
  action: IssueDevSessionAction;
  /**
   * 実物の API へ繋いでいるか。
   *
   * @remarks
   * トークンを取りに行くかどうかの**既定**にします。画面が推測すると、設定を変えるたびに
   * 既定と実態がずれます。切り替え自体は残すので、繋ぎ先と違う組み合わせも試せます。
   */
  connectsLiveApi: boolean;
  /**
   * 設定が指している IdP。接続先の**初期値**にする。
   *
   * @remarks
   * 初期値であって固定値ではありません。開発機ではバックエンドを複数の口で並行して立てるため、
   * いま叩いている API が期待する IdP と設定の値がずれます。**どれが正かを知っているのは、その場で
   * 繋ぎ先を選んでいる人**なので、書き換えられる形で出します。
   */
  defaultIssuer: string;
};

/** 既定の subject。実在の利用者を指さない値にしておく。 */
const DEFAULT_SUBJECT = "dev-user";

/** 既定の失効までの秒数。 */
const DEFAULT_EXPIRES_IN_SECONDS = 3600;

const ROLE_LABEL: Readonly<Record<SessionRole, string>> = {
  [SESSION_ROLE.user]: "一般利用者",
  [SESSION_ROLE.admin]: "管理者",
};

/**
 * 項目ごとの補足。
 *
 * @remarks
 * 外枠と入力欄の両方へ配るのは `FormField` の側の仕事です。
 */
const SUBJECT_DESCRIPTION = "この値がそのまま session の利用者 ID になります。";
const EXPIRES_DESCRIPTION = "短くすると、失効したあとの見え方をその場で確かめられます。";
const ISSUER_DESCRIPTION =
  "いま叩いている API が期待する IdP を指します。設定の値を初期値にしていますが、口を分けて並行して立てているならそちらへ書き換えます。";
const TOKEN_DESCRIPTION = "自分で取ったトークンを使うときだけ貼ります。空欄でも発行はできます。";

/**
 * 理由ごとの案内。
 *
 * @remarks
 * 理由を鍵にした表で持ちます。**理由が増えたときに文言が無いことを型が咎める**ためで、
 * 分岐を並べると、文言の無い理由が無言で素通りします。
 */
const NOTICE_TEXT = {
  [AUTHORIZE_ERROR.INVALID]: "発行の指定を確認してください。",
  [AUTHORIZE_ERROR.UNAVAILABLE]:
    "IdP からトークンを取れませんでした。接続先を確かめてから、もう一度お試しください。",
} as const satisfies Readonly<Record<AuthorizeError, string>>;

const SUBMIT_LABEL = "この内容で入る";
const PENDING_LABEL = "session を発行しています";

/**
 * 送信の下に出す 1 文を決める。
 *
 * @remarks
 * 出所が 2 つあります。その場で発行する送信の結果（Server Action の戻り値）と、認可 endpoint が
 * URL で戻した理由です。**同時には立ちません** —— 送信先はどちらか一方だけなので、直近の送信の
 * 結果があればそちらを採ります。
 */
function toFeedback(
  state: DevSessionFormState,
  authorization: AuthorizationHandoff | null,
): string | null {
  if (state.status === "error") {
    return state.formError;
  }

  const notice = authorization?.notice ?? null;

  return notice === null ? null : NOTICE_TEXT[notice];
}

/** 送信部。`useFormStatus` は form の子でしか状態を読めないため切り出している。 */
function IssueSubmit() {
  const { pending } = useFormStatus();

  return (
    <Button aria-label={pending ? PENDING_LABEL : undefined} disabled={pending} type="submit">
      {SUBMIT_LABEL}
    </Button>
  );
}

/**
 * IdP を通さずに session を発行する指定。
 *
 * @remarks
 * **「API 接続モード」が入っていると、トークンはこちらで取ります。** 実物の API へ繋いでいる間、
 * 検証されない前提のトークンは 401 で弾かれます。それを避けるために利用者へ手作業（別の口を
 * 叩いてトークンを写す）を要求すると、写し間違いと期限切れがそのまま「画面が壊れている」と
 * して現れます。取り方そのものは画面が知りません（`adapters/server/auth/development-token.ts`）。
 *
 * **貼る欄は、入っていないときだけ出します。** 両方が同時に見えていると、どちらが効くのかを
 * 見た目から決められません。自分で取ったトークンを使いたいときは切ってから貼ります。
 *
 * **接続先は書き換えられる形で出します**（{@link DevSessionFormProps.defaultIssuer}）。ずれたまま
 * 取ると、トークンは出るのに API で 401 になります。
 *
 * 役割は radio です。同時に 1 つしか選べないものを選ぶ操作であり、既定を持ちます。
 *
 * 失効までの秒数を指定できるのは、**失効したときの見え方を確かめるため**です。短い値を入れると、
 * その秒数のあとに保護された画面がどうなるかを実際に踏めます。
 *
 * **認可の往復の途中では素の form 送信になります。** 送信中の表示と項目ごとの理由はそのとき
 * 出ません —— どちらも Server Action の戻り値に載る情報で、素の送信は状態を持ち越せないためです。
 * 認可 endpoint が分類しか戻さないこと（[`authorize-error.ts`](../../authorize-error.ts) の
 * `AUTHORIZE_ERROR`）と、そこで揃います。
 */
export function DevSessionForm({
  returnUrl,
  authorization,
  action,
  connectsLiveApi,
  defaultIssuer,
}: DevSessionFormProps) {
  const [state, formAction] = useActionState<DevSessionFormState, FormData>(
    action,
    idleActionState(),
  );
  const subjectId = useId();
  const expiresId = useId();
  const tokenId = useId();
  const issueTokenId = useId();
  const issuerId = useId();
  const [issuesToken, setIssuesToken] = useState(connectsLiveApi);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const feedback = toFeedback(state, authorization);
  const toggleIssuesToken = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setIssuesToken(event.currentTarget.checked);
  }, []);

  return (
    <form
      action={authorization === null ? formAction : DEV_AUTHORIZE_PATH}
      className="flex flex-col gap-6"
      method={authorization === null ? undefined : "post"}
    >
      <input name={RETURN_URL_PARAM} type="hidden" value={returnUrl} />
      {authorization === null ? null : (
        <input name={STATE_PARAM} type="hidden" value={authorization.state} />
      )}

      <FormField
        controlId={subjectId}
        description={SUBJECT_DESCRIPTION}
        label="誰として入るか"
        message={errors?.subject?.[0]}
        required
      >
        {(control) => <Input {...control} defaultValue={DEFAULT_SUBJECT} name="subject" />}
      </FormField>

      <RadioGroupNative>
        <legend className="mb-3 font-emphasis text-sm">役割</legend>
        {Object.values(SESSION_ROLE).map((role) => (
          <div className="flex items-center gap-2" key={role}>
            <RadioGroupNativeItem
              defaultChecked={role === SESSION_ROLE.user}
              id={`${subjectId}-${role}`}
              name="role"
              value={role}
            />
            <Label htmlFor={`${subjectId}-${role}`}>{ROLE_LABEL[role]}</Label>
          </div>
        ))}
      </RadioGroupNative>

      <FormField
        controlId={expiresId}
        description={EXPIRES_DESCRIPTION}
        label="失効までの秒数"
        message={errors?.expiresInSeconds?.[0]}
        required
      >
        {(control) => (
          <Input
            {...control}
            defaultValue={DEFAULT_EXPIRES_IN_SECONDS}
            inputMode="numeric"
            name="expiresInSeconds"
          />
        )}
      </FormField>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <SwitchNative
            checked={issuesToken}
            id={issueTokenId}
            name="issueAccessToken"
            onChange={toggleIssuesToken}
          />
          <Label htmlFor={issueTokenId}>API 接続モード</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          {issuesToken
            ? "上の「誰として入るか」で開発用 IdP からトークンを取り、session に載せます。実物の API へそのまま繋がります。"
            : "検証されない前提のトークンを載せます。モックへ繋いでいる間はこれで足ります。"}
        </p>
      </div>

      {issuesToken ? (
        <FormField
          controlId={issuerId}
          description={ISSUER_DESCRIPTION}
          label="IdP の接続先"
          message={errors?.issuerUrl?.[0]}
          required
        >
          {(control) => (
            <Input
              {...control}
              className="font-mono text-xs"
              defaultValue={defaultIssuer}
              inputMode="url"
              name="issuerUrl"
            />
          )}
        </FormField>
      ) : null}

      {issuesToken ? null : (
        <FormField
          controlId={tokenId}
          description={TOKEN_DESCRIPTION}
          label="Access Token（任意）"
          message={errors?.accessToken?.[0]}
          required={false}
        >
          {(control) => (
            <Textarea {...control} className="font-mono text-xs" name="accessToken" rows={4} />
          )}
        </FormField>
      )}

      <div className="flex flex-col gap-2">
        <IssueSubmit />
        {feedback === null ? null : (
          <FormFeedback
            description={feedback}
            title="session を発行できませんでした"
            variant="destructive"
          />
        )}
      </div>
    </form>
  );
}

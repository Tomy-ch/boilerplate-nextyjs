/**
 * いま操作している主体が、この系の利用者としてどの段階にいるか。
 *
 * @remarks
 * **認証と登録は別の状態です。** IdP を通った主体には身元がありますが、この系にはまだ利用者の
 * 記録が無いことがあります（初回ログイン）。前者はログインでしか、後者は登録でしか解消しない
 * ので、「入れない」を 1 つに畳みません。
 */
export type RegistrationStatus = "unauthenticated" | "unregistered" | "registered";

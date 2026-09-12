/**
 * バナーが出す文言。
 *
 * @remarks
 * **最初に書き換える場所です。** 何にどの cookie を使うかは繋ぐ製品で変わり、どこまで
 * 書くかは法域で変わります。文言を props にしないのは、渡し忘れた画面が既定の文面のまま公開
 * されるより、書き換える場所が 1 つだけある方が安全なためです。
 *
 * `description` は「必要なもの」と「任意のもの」の区別が読み取れる形にします。区別が読めない
 * 文面で得た同意は、区分ごとの意思として扱えません。
 *
 * **書き換えたら `model/consent` の `CONSENT_COPY_VERSION` を上げてください。** 版は意思と一緒に
 * cookie へ載り、いまの版と違う同意は未選択へ倒れます。上げないと、**新しい文面を見ていない利用者の
 * 同意が効いたまま**になります。
 */
export const CONSENT_BANNER_COPY: Readonly<{
  title: string;
  description: string;
  accept: string;
  reject: string;
  policy: string;
}> = {
  title: "cookie の利用について",
  description:
    "この画面を表示するために必要な cookie は常に使います。利用状況の計測に使う cookie は、同意をいただいたときだけ有効にします。",
  accept: "同意する",
  reject: "必要なものだけ使う",
  policy: "プライバシーポリシー",
};

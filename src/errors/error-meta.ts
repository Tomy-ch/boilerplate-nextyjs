/** エラーに付与できる protocol-agnostic なメタ情報の入力です。 */
export type ErrorMetaOptions = Readonly<{
  /** 機械可読なエラーコードです。空文字の場合はカタログの既定値を使います。 */
  code?: string;
  /** 利用者へ表示する文言です。空文字の場合はカタログの既定値を使います。 */
  message?: string;
  /** ログ相関と、利用者からの連絡の突き合わせに使う、バックエンドが発行した識別子です。 */
  requestId?: string;
  /** 公開して安全な詳細識別子です。入力値や理由文は渡してはいけません。 */
  details?: readonly string[];
}>;

/**
 * 分類とは独立して付与する、プロトコル非依存のエラーメタ情報です。
 *
 * インスタンスは不変であり、配列は生成時と取得時の双方でコピーします。
 */
export class ErrorMeta {
  readonly #code: string;
  readonly #message: string;
  readonly #requestId: string;
  readonly #details: readonly string[];

  private constructor({ code = "", message = "", requestId = "", details = [] }: ErrorMetaOptions) {
    this.#code = code;
    this.#message = message;
    this.#requestId = requestId;
    this.#details = [...details];
  }

  /** 指定した値から不変のメタ情報を生成します。 */
  static create(options: ErrorMetaOptions = {}): ErrorMeta {
    return new ErrorMeta(options);
  }

  /** 機械可読なエラーコードを返します。 */
  get code(): string {
    return this.#code;
  }

  /** 利用者へ表示する文言を返します。 */
  get message(): string {
    return this.#message;
  }

  /** ログ相関と、利用者からの連絡の突き合わせに使う識別子を返します。 */
  get requestId(): string {
    return this.#requestId;
  }

  /** 公開可能な詳細識別子のコピーを返します。 */
  get details(): readonly string[] {
    return [...this.#details];
  }

  /**
   * 利用者向け文言だけを置き換えたメタ情報を返します。
   *
   * 文言の正は境界のカタログに置くため、通常の利用は境界層に限ります。
   */
  withMessage(message: string): ErrorMeta {
    return createErrorMeta({
      code: this.#code,
      message,
      requestId: this.#requestId,
      details: this.#details,
    });
  }
}

/** protocol-agnostic なエラーメタ情報を生成します。 */
export function createErrorMeta(options: ErrorMetaOptions = {}): ErrorMeta {
  return ErrorMeta.create(options);
}

class ErrorWithMeta extends Error {
  readonly meta: ErrorMeta;

  constructor(error: Error, meta: ErrorMeta) {
    super(error.message, { cause: error });
    this.name = "ErrorWithMeta";
    this.meta = meta;
  }
}

/**
 * cause chain を保ったまま、エラーへメタ情報を付与します。
 *
 * `undefined` はそのまま返すため、任意エラーを扱う呼び出し元で明示的な分岐を増やしません。
 */
export function withErrorMeta(error: Error, meta: ErrorMeta): Error;
/** @inheritdoc */
export function withErrorMeta(error: undefined, meta: ErrorMeta): undefined;
/** @inheritdoc */
export function withErrorMeta(error: Error | undefined, meta: ErrorMeta): Error | undefined {
  if (error === undefined) {
    return undefined;
  }

  return new ErrorWithMeta(error, meta);
}

/**
 * cause chain を保ったまま、公開可能な詳細識別子だけをエラーへ付与します。
 */
export function withErrorDetails(error: Error, details: readonly string[]): Error;
/** @inheritdoc */
export function withErrorDetails(error: undefined, details: readonly string[]): undefined;
/** @inheritdoc */
export function withErrorDetails(
  error: Error | undefined,
  details: readonly string[],
): Error | undefined {
  if (error === undefined) {
    return undefined;
  }

  return withErrorMeta(error, createErrorMeta({ details }));
}

/**
 * cause chain の最も外側にあるメタ情報を返します。
 *
 * 上位層が意図して再ラップしたメタ情報を優先します。
 */
export function errorMetaFrom(error: unknown): ErrorMeta | undefined {
  const seen = new Set<Error>();
  let current = error;

  while (current instanceof Error && !seen.has(current)) {
    if (current instanceof ErrorWithMeta) {
      return current.meta;
    }

    seen.add(current);
    current = current.cause;
  }

  return undefined;
}

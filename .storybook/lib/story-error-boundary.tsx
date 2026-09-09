import { Component, type ErrorInfo, type ReactNode } from "react";

type StoryErrorBoundaryProps = {
  children: ReactNode;
};

type StoryErrorBoundaryState = {
  message: string | null;
};

/**
 * story の描画・操作で投げられた例外を、その場の 1 枚として見せる。
 *
 * @remarks
 * **黙らせるためではありません。** カタログはテンプレートから作った側が最初に読む面なので、押した操作が
 * スタックトレースの赤い画面へ飛ばすのは説明になりません。一方で、無かったことにすると
 * 壊れた story が緑のまま残ります。**見え方だけを穏やかにし、起きたことは残します** ——
 * 文言を出し、`data-story-error` を付け、console へも出します。
 *
 * カタログでは Server Action が server を持たないブラウザで実行されるため、`config` の読み込みで
 * 落ちます。差し替えの機構が効かないあいだ、ここが受け止める先になります。
 *
 * story が変わったら作り直します（decorator が `key` を与えます）。持ち越すと、直した story まで
 * 落ちたままに見えます。
 */
export class StoryErrorBoundary extends Component<
  StoryErrorBoundaryProps,
  StoryErrorBoundaryState
> {
  override state: StoryErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): StoryErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("[story-error]", error, info.componentStack);
  }

  override render(): ReactNode {
    const { message } = this.state;

    if (message === null) {
      return this.props.children;
    }

    return (
      <div
        className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm"
        data-story-error=""
        role="alert"
      >
        <strong className="text-destructive">この story は最後まで描けませんでした</strong>
        <p className="text-muted-foreground">
          カタログには server がないため、Server Action を押すとその先の読み込みで落ちます。
          画面としての動きは、起動したアプリで確かめてください。
        </p>
        <code className="whitespace-pre-wrap break-all text-muted-foreground text-xs">
          {message}
        </code>
      </div>
    );
  }
}

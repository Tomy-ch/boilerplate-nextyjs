import Link from "next/link";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";

/**
 * どの route group にも属さない URL の not-found 境界。
 *
 * @remarks
 * root layout の中で描画されるため `html` / `body` を持ちません。route group の shell は
 * 通らないので、この画面だけで戻る導線を完結させます。
 *
 * **`main` もこの画面が自分で置きます**（[README](./README.md)）。
 *
 * より近い segment に `not-found.tsx` があればそちらが優先されます。ここは受け口が他に
 * 無い場合にだけ描画されます。
 */
export default function NotFound() {
  return (
    <main>
      <ContentContainer className="flex flex-col items-start gap-4 py-16">
        <h1 className="text-xl font-emphasis">
          {getDefaultErrorMeta(ErrorKind.NOT_FOUND).message}
        </h1>
        <Link className="underline" href="/">
          トップへ戻る
        </Link>
      </ContentContainer>
    </main>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { ToastProvider } from "@/components/shell/toaster/toaster";
import { getSiteConfig } from "@/config/site/site.server";
import { findActiveTraceparent } from "@/observability/trace-context.server";

import { Analytics } from "./analytics";
import { Consent } from "./consent";
import { FONT_VARIABLES } from "./fonts";
import { SITE_DESCRIPTION, SITE_NAME } from "./site";
import { Telemetry } from "./telemetry";
import "./globals.css";

const site = getSiteConfig();

/**
 * 全 route の metadata の土台（[0044](../../docs/adr/0044-seo-metadata-strategy.md)）。
 *
 * @remarks
 * `metadataBase` があるので、各 segment は canonical と OG 画像を経路だけで宣言できます。
 * **canonical はここに置きません** —— 理由は [README](./README.md)「metadata の土台と差分」。
 *
 * 索引させない環境では `noindex` をここで宣言します（`docs/rules.md`「設定と環境」の「索引させてよい
 * 環境だけが `SITE_INDEXABLE=on` を宣言する」）。個々の画面が `robots` を持たない限り継承されるので、
 * 画面の側は索引させる環境でも隠すもの（認証の要る画面など）だけを宣言します。
 */
export const metadata: Metadata = {
  metadataBase: new URL(site.publicOrigin),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  ...(site.isIndexable ? {} : { robots: { index: false, follow: false } }),
};

/**
 * 計測の口。
 *
 * @remarks
 * 現在地と要求の文脈（`traceparent`）を読むため、殻の中では決まりません
 * （[0041](../../docs/adr/0041-cache-components-decision.md)）。**描くものを持たないので、待つ間に
 * 見えるものは何も変わりません。**
 */
function TelemetryHole() {
  return <Telemetry traceparent={findActiveTraceparent()} />;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${FONT_VARIABLES} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <TelemetryHole />
        </Suspense>
        <ToastProvider>
          <div className="flex flex-1 flex-col" data-slot="app-root">
            {children}
          </div>
        </ToastProvider>
        <Consent>
          <Analytics />
        </Consent>
      </body>
    </html>
  );
}

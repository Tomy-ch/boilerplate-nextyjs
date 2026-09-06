import type { Preview } from "@storybook/nextjs-vite";
import { sb } from "storybook/test"; // sample:line

import { FONT_VARIABLES } from "@/app/fonts";
import { ToastProvider } from "@/components/shell/toaster/toaster";
import { StoryErrorBoundary } from "./lib/story-error-boundary";
import { startMockWorker } from "./msw/worker";

import "../src/app/globals.css";
import "./preview.css";

// sample:begin
// Server Action を持つモジュールを、隣の `__mocks__` へ差し替える
// （[0054](../docs/adr/0054-ui-catalog-storybook.md)）。
//
// パスは拡張子まで書く。省くと解決に失敗し、宣言はしているのに 1 件も登録されないまま進む。
sb.mock(import("../src/features/account/actions.ts"));
sb.mock(import("../src/features/cart/actions.ts"));
sb.mock(import("../src/features/cart/facade/add-to-cart/add-to-cart.ts"));
sb.mock(import("../src/features/checkout/actions.ts"));
sb.mock(import("../src/features/purchases/actions.ts"));
// sample:end

// 書体の変数は `next/font` が class に載せる。実アプリの `<html>` と同じ位置へ置かないと、
// カタログだけが素の書体で表示され、基準画像が実物と一致しない。
// カタログは実アプリと違い、系統をまたいで並べる。管理の書体は実アプリでは管理の面だけが
// 読むが（0051 §5）、ここでは両方の系統の story を同じ文書で描くので、まとめて配る。
document.documentElement.classList.add(...FONT_VARIABLES.split(" "));

const SYSTEM_THEME = "system";
const DEFAULT_SURFACE = "user";

const preview: Preview = {
  // 同一オリジンの `/api/*` は [msw](msw/handlers.ts) が答える
  // （[0054](../docs/adr/0054-ui-catalog-storybook.md)）。story 側で `fetch` は差し替えない。
  loaders: [
    async () => {
      await startMockWorker();
    },
  ],
  globalTypes: {
    theme: {
      description: "配色テーマ",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: [
          { value: SYSTEM_THEME, title: "OS の設定に従う" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
    surface: {
      description: "系統",
      toolbar: {
        title: "Surface",
        icon: "component",
        items: [
          { value: DEFAULT_SURFACE, title: "利用者" },
          { value: "admin", title: "管理" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: SYSTEM_THEME,
    surface: DEFAULT_SURFACE,
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme;
      // tokens.css と globals.css の dark variant は :root の data-theme を見る。
      // 属性を外すと OS の設定に戻る。
      if (theme === SYSTEM_THEME) {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", String(theme));
      }

      return Story(context);
    },
    // 系統は `body` へ置く。story の木だけを包むと Portal の中身が属性の外へ落ちる
    // （`tokens/README.md`）。既定の系統は `:root` に出るので、戻すときは属性を外す。
    (Story, context) => {
      const surface = String(context.globals.surface);

      if (surface === DEFAULT_SURFACE) document.body.removeAttribute("data-surface");
      else document.body.dataset.surface = surface;

      return Story(context);
    },
    // 実アプリが横断 Provider を layout shell へ mount するのと同じ位置に置く
    // （[0026](../docs/adr/0026-layout-shell-mount.md)）。story ごとに包むと、包み忘れた story は
    // 部品ではなく Storybook のエラー画面を描き、それが基準画像として承認されうる。
    (Story) => <ToastProvider>{Story()}</ToastProvider>,
    // 例外は `StoryErrorBoundary` が受け止める（理由は同 component の doc コメント）。
    // story ごとに作り直すため key を与える。
    (Story, context) => <StoryErrorBoundary key={context.id}>{Story()}</StoryErrorBoundary>,
  ],
  parameters: {
    a11y: {
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      // このリポジトリは App Router のみを使う (ADR 0040)。useRouter などの
      // navigation hook は App Router の context が無いと throw するため、既定で有効にする。
      appDirectory: true,
    },
    options: {
      storySort: {
        // 並び順の根拠は `src/components/README.md`「Storybook の表示規約」
        method: "alphabetical",
        // 画面 → 画面固有の部品 → token の目録 → アイコンの目録 → 部品の目録。以降は名前順
        order: ["Page", "Features", "Tokens", "Icons", "*"],
      },
    },
  },
  // 説明は Docs ページにしか出ない（`src/components/README.md`）
  tags: ["autodocs"],
};

export default preview;

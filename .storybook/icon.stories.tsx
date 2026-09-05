import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps, ComponentType } from "react";

import * as icons from "@/components/icon";

/**
 * 公開面が配っているアイコンの全件。
 *
 * @remarks
 * 名前を書き写さず、公開面（`src/components/icon.ts`）から実行時に読みます。書き写すと、
 * アイコンを足したときに一覧の側が古いままになり、目録として信用できなくなります。
 *
 * ここは Storybook 自身の資料であり、アプリが描画する部品ではありません。名前空間 import を
 * 使っているのはそのためで、この束はカタログにしか載りません。
 */
const CATALOG: readonly (readonly [string, ComponentType<ComponentProps<"svg">>])[] = Object.entries(
  icons,
).sort(([left], [right]) => left.localeCompare(right));

/** 部品が実際に使っている大きさ。この 3 つ以外の指定はカタログにも実装にも無い。 */
const SIZES = ["size-3", "size-3.5", "size-4"] as const;

function Catalog() {
  return (
    <div className="p-6">
      <p className="mb-4 text-sm text-muted-foreground">
        {CATALOG.length} 件。名前は `@/components/icon` の公開名で、呼び出し側が書くのはこの綴りです。
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1">
        {CATALOG.map(([name, Icon]) => (
          <li className="flex items-center gap-2 rounded-md p-2 hover:bg-muted" key={name}>
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <code className="truncate text-xs">{name}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SizeLadder() {
  return (
    <table className="m-6 text-sm">
      <thead>
        <tr>
          <th className="p-2 text-left font-emphasis">名前</th>
          {SIZES.map((size) => (
            <th className="p-2 text-left font-emphasis" key={size}>
              <code>{size}</code>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CATALOG.map(([name, Icon]) => (
          <tr key={name}>
            <td className="p-2">
              <code className="text-xs">{name}</code>
            </td>
            {SIZES.map((size) => (
              <td className="p-2" key={size}>
                <Icon aria-hidden="true" className={size} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * アプリが使うアイコンの目録。
 *
 * 名前は公開面から実行時に読むので、`icon.ts` へ足せばこの画面に出ます。供給元を差し替えても、
 * 出るのは新しい字面で、名前の列は動きません。
 */
const meta = {
  title: "Icons/Catalog",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "公開面が配っているアイコンの全件。名前は `@/components/icon` から実行時に読む。",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** 公開されているアイコンを、部品が既定で使う大きさで並べたもの。 */
export const Default: Story = {
  render: () => <Catalog />,
};

/** 同じアイコンを、部品が実際に指定する 3 つの大きさで並べたもの。小さい側の可読性を見る。 */
export const Sizes: Story = {
  render: () => <SizeLadder />,
};

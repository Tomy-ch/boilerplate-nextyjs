import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import type { ChangeEvent } from "react";
import { useCallback, useId, useState } from "react";
import { userEvent, within } from "storybook/test";

import { Input } from "@/components/design-system/form/input/input";
import { Label } from "@/components/design-system/form/label/label";
import { UnsavedChangesGuard, useUnsavedChanges } from "./unsaved-changes-guard";

/**
 * 器に包まれる側。書きかけかどうかを決めるのは画面であって器ではないので、判断はここが持つ。
 *
 * 器の外にある導線（パンくず・脇の一覧）を link で再現する。実画面でもこれらは画面より上に
 * あり、確認が要るのはまさにこの経路である。
 */
function EditScreen() {
  const nameId = useId();
  const [value, setValue] = useState("ワイヤレスイヤホン");
  const isDirty = value !== "ワイヤレスイヤホン";

  useUnsavedChanges(isDirty);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  }, []);

  return (
    <div className="flex w-96 flex-col gap-4 rounded-md border border-border p-4">
      <nav className="flex gap-4 text-sm">
        <Link className="underline underline-offset-4" href="/admin/products">
          商品一覧管理
        </Link>
      </nav>
      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>商品名</Label>
        <Input id={nameId} name="name" onChange={handleChange} value={value} />
      </div>
      <p className="text-sm text-muted-foreground">
        {isDirty ? "書きかけがあります。" : "書きかけはありません。"}
      </p>
    </div>
  );
}

const meta = {
  title: "Features/Admin/UnsavedChangesGuard",
  component: UnsavedChangesGuard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "書きかけがあるあいだ、画面を離れる操作へ確認を挟む器です。**書きかけかどうかを器は決めません**",
          "—— 判断するのは入力を持つ画面で、器は申告を読むだけです。器の階層に置くのは、離れる操作の",
          "起点（パンくず・脇の一覧）が画面より上にあり、画面の内側から包めないためです。",
          "browser の戻る / 進むはこの器では塞げません。",
        ].join(""),
      },
    },
  },
  args: { children: null },
  render: () => (
    <UnsavedChangesGuard>
      <EditScreen />
    </UnsavedChangesGuard>
  ),
} satisfies Meta<typeof UnsavedChangesGuard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 何も書き換えていない状態。申告が無いので link はそのまま通る。 */
export const Clean: Story = {};

/** 書きかけがある状態。申告は済んでいるが、離れる操作をするまで何も出ない。 */
export const Dirty: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByLabelText("商品名"), " 第 3 世代");
  },
};

/** 書きかけを抱えたまま離れようとした状態。確認は portal で画面の側へ出る。 */
export const Confirming: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText("商品名"), " 第 3 世代");
    await userEvent.click(canvas.getByRole("link", { name: "商品一覧管理" }));
    await within(document.body).findByRole("alertdialog");
  },
};

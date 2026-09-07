import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ChangeEvent } from "react";
import { useCallback, useId, useState } from "react";

import { Button } from "@/components/design-system/action/button/button";
import {
  KeyValueItem,
  KeyValueLabel,
  KeyValueList,
  KeyValueValue,
} from "@/components/design-system/display/key-value-list/key-value-list";
import { Field, FieldDescription, FieldLabel } from "@/components/design-system/form/field/field";
import { Input } from "@/components/design-system/form/input/input";
import { Textarea } from "@/components/design-system/form/textarea/textarea";
import { WizardForm, type WizardSteps } from "./wizard-form";

const meta = {
  title: "Form/WizardForm",
  component: WizardForm,
  parameters: { layout: "padded" },
} satisfies Meta<typeof WizardForm>;
export default meta;
type Story = StoryObj<typeof meta>;

function ApplicantFields() {
  const nameId = useId();
  const mailId = useId();

  return (
    <>
      <Field>
        <FieldLabel htmlFor={nameId}>氏名</FieldLabel>
        <Input defaultValue="田中 太郎" id={nameId} name="name" />
      </Field>
      <Field>
        <FieldLabel htmlFor={mailId}>連絡先</FieldLabel>
        <Input defaultValue="tanaka@example.com" id={mailId} name="mail" type="email" />
        <FieldDescription>審査結果の連絡に使います。</FieldDescription>
      </Field>
    </>
  );
}

function PurposeFields() {
  const purposeId = useId();

  return (
    <Field>
      <FieldLabel htmlFor={purposeId}>利用目的</FieldLabel>
      <Textarea defaultValue="開発環境の検証" id={purposeId} name="purpose" rows={4} />
    </Field>
  );
}

function Confirmation() {
  return (
    <KeyValueList>
      <KeyValueItem>
        <KeyValueLabel>氏名</KeyValueLabel>
        <KeyValueValue>田中 太郎</KeyValueValue>
      </KeyValueItem>
      <KeyValueItem>
        <KeyValueLabel>連絡先</KeyValueLabel>
        <KeyValueValue>tanaka@example.com</KeyValueValue>
      </KeyValueItem>
      <KeyValueItem>
        <KeyValueLabel>利用目的</KeyValueLabel>
        <KeyValueValue>開発環境の検証</KeyValueValue>
      </KeyValueItem>
    </KeyValueList>
  );
}

const STEPS = [
  { id: "applicant", title: "申請者", content: <ApplicantFields /> },
  { id: "purpose", title: "利用目的", content: <PurposeFields /> },
  { id: "confirm", title: "確認", content: <Confirmation /> },
] satisfies WizardSteps;

/**
 * 3 段階の申請。段階を移っても隠れた段階の入力値は form に残るため、最後の送信で全段階ぶんが
 * 送られる。
 */
export const Default: Story = {
  args: {
    label: "利用申請",
    steps: STEPS,
    submit: <Button type="submit">申請する</Button>,
  },
  render: (args) => (
    <form className="max-w-xl">
      <WizardForm {...args} />
    </form>
  ),
};

/** 段階が 2 つだけの場合。2 段階目がそのまま最後になる。 */
export const TwoSteps: Story = {
  args: {
    label: "利用申請",
    steps: [STEPS[1], STEPS[2]],
    submit: <Button type="submit">申請する</Button>,
  },
  render: (args) => (
    <form className="max-w-xl">
      <WizardForm {...args} />
    </form>
  ),
};

/** 操作の文言を差し替えた場合。 */
export const CustomLabels: Story = {
  args: {
    label: "利用申請",
    nextLabel: "次の項目へ",
    previousLabel: "前の項目へ",
    steps: STEPS,
    submit: <Button type="submit">この内容で申請</Button>,
  },
  render: (args) => (
    <form className="max-w-xl">
      <WizardForm {...args} />
    </form>
  ),
};

function ValidatedWizard() {
  const [name, setName] = useState("");
  const nameId = useId();
  const changeName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [],
  );

  return (
    <form className="max-w-xl">
      <WizardForm
        label="利用申請"
        steps={[
          {
            id: "applicant",
            title: "申請者",
            blocked: name === "",
            content: (
              <Field>
                <FieldLabel htmlFor={nameId}>氏名</FieldLabel>
                <Input id={nameId} name="name" onChange={changeName} value={name} />
                <FieldDescription>入力するまで次へ進めません。</FieldDescription>
              </Field>
            ),
          },
          { id: "purpose", title: "利用目的", content: <PurposeFields /> },
        ]}
        submit={<Button type="submit">申請する</Button>}
      />
    </form>
  );
}

/**
 * 進めてよいかを呼び出し元が決める場合。検証そのものはこの部品が持たず、結果を `blocked` として
 * 受け取る。
 */
export const Blocked: Story = {
  args: {
    label: "利用申請",
    steps: STEPS,
    submit: <Button type="submit">申請する</Button>,
  },
  render: () => <ValidatedWizard />,
};

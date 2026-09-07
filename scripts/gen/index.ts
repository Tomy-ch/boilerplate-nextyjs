import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DEPENDENCIES } from "../../architecture";
import { readComponentPlacement } from "./component-placement";
import { readFeaturePlacement } from "./feature-placement";
import { readLayerContract } from "./layer-contract";
import { componentManifestEntry, isRecorded, recordComponent } from "./manifest";
import { validateName } from "./naming";
import { type GenerationInput, isGenerationKind, planGeneration } from "./plan";

/**
 * 雛形生成の入口。`pnpm gen <kind> <name> [--screen=<画面>] [--as=<見出し>] [--layer=<層>]` から呼ばれる。
 *
 * @remarks
 * 生成は段階に分け、前段が確定しないうちは次段へ進みません。導出できない入力に出会ったら、
 * 書きかけを片付けようとせず、そこで止めて理由を出します。1 ファイルも書いていない時点で
 * 止まるので、ロールバックは要りません。
 */

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..", "..");

/** feature の契約を読む層 README。 */
const FEATURES_README = "src/features/README.md";

/** feature の README の元になるテンプレート。`src/features/README.md` が置き場を定める。 */
const FEATURE_README_TEMPLATE = "docs/templates/feature-readme.md";

/** component の README の元になるテンプレート。`src/components/README.md` が置き場を定める。 */
const COMPONENT_README_TEMPLATE = "src/components/component-template.md";

/** 生成した component を記録する台帳。 */
const COMPONENT_MANIFEST = "src/components/shadcn-manifest.yaml";

const USAGE =
  "使い方: pnpm gen <feature|component|adapter> <kebab-case-name> [feature の画面: --screen=<画面>] [component の配置: --as=<見出し> [--layer=<層>]]";

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function readRepositoryFile(path: string, missingMessage: string): string {
  const absolute = resolve(REPOSITORY_ROOT, path);

  if (!existsSync(absolute)) {
    fail(missingMessage);
  }

  return readFileSync(absolute, "utf8");
}

function featureInput(featureName: string, placementOptions: readonly string[]): GenerationInput {
  const result = readFeaturePlacement(placementOptions);

  if ("error" in result) {
    fail(result.error);
  }

  const contract = readLayerContract(
    readRepositoryFile(
      FEATURES_README,
      `層 README ${FEATURES_README} が見つかりません。生成先の層が未整備です。`,
    ),
  );

  if (contract === null) {
    fail(
      `${FEATURES_README} の frontmatter から forbidden / test-requirement を読めません。層の宣言を先に整えてください。`,
    );
  }

  return {
    kind: "feature",
    name: featureName,
    placement: result.placement,
    importsAllowed: DEPENDENCIES.features,
    contract,
    readmeTemplate: readRepositoryFile(
      FEATURE_README_TEMPLATE,
      `テンプレート ${FEATURE_README_TEMPLATE} が見つかりません。feature の README の形を先に整えてください。`,
    ),
  };
}

function componentInput(
  componentName: string,
  placementOptions: readonly string[],
): GenerationInput {
  const result = readComponentPlacement(placementOptions);

  if ("error" in result) {
    fail(result.error);
  }

  return {
    kind: "component",
    name: componentName,
    placement: result.placement,
    readmeTemplate: readRepositoryFile(
      COMPONENT_README_TEMPLATE,
      `テンプレート ${COMPONENT_README_TEMPLATE} が見つかりません。component の README の形を先に整えてください。`,
    ),
  };
}

const [kind, name, ...options] = process.argv.slice(2);

if (kind === undefined || name === undefined) {
  fail(USAGE);
}

if (!isGenerationKind(kind)) {
  fail(
    `種類 "${kind}" は生成できません。feature / component / adapter のいずれかを指定してください。`,
  );
}

const nameError = validateName(name);

if (nameError !== null) {
  fail(nameError);
}

if (kind === "adapter" && options.length > 0) {
  fail(`${kind} は配置オプションを取りません。${USAGE}`);
}

const input: GenerationInput =
  kind === "feature"
    ? featureInput(name, options)
    : kind === "component"
      ? componentInput(name, options)
      : { kind, name };

const files = planGeneration(input);

const existing = files.filter((file) => existsSync(resolve(REPOSITORY_ROOT, file.path)));

if (existing.length > 0) {
  fail(`次のパスが既に在ります。上書きしません: ${existing.map((file) => file.path).join(", ")}`);
}

/** 台帳へ行を足した全文。行が既に在るなら、1 ファイルも書かずに止まる。 */
function recordedManifestOf(
  componentName: string,
  placement: Extract<GenerationInput, { kind: "component" }>["placement"],
): string {
  const source = readRepositoryFile(
    COMPONENT_MANIFEST,
    `台帳 ${COMPONENT_MANIFEST} が見つかりません。`,
  );

  if (isRecorded(source, componentName)) {
    fail(
      `${COMPONENT_MANIFEST} に "${componentName}" の行が既に在ります。台帳の行を先に片付けてください。`,
    );
  }

  return recordComponent(
    source,
    componentName,
    componentManifestEntry(componentName, placement, new Date().toISOString()),
  );
}

// 台帳の全文は書き出しの前に確定させる
const recordedManifest =
  input.kind === "component" ? recordedManifestOf(name, input.placement) : null;

for (const file of files) {
  const absolute = resolve(REPOSITORY_ROOT, file.path);

  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, file.content, "utf8");
}

if (recordedManifest !== null) {
  writeFileSync(resolve(REPOSITORY_ROOT, COMPONENT_MANIFEST), recordedManifest, "utf8");
}

console.log(`✅ ${kind} "${name}" の雛形を生成しました`);

for (const file of files) {
  console.log(`   ${file.path}`);
}

if (input.kind === "component") {
  console.log(`   ${COMPONENT_MANIFEST}（"${name}" の行を追加）`);
}

const NEXT_STEPS = {
  feature:
    "\n次に行うこと:\n  1. README の placeholder を実装に合わせて具体化する\n  2. story を route と同じ器で包み、画面が取る状態を足して説明を書く\n  3. pnpm fix && pnpm lint:ci\n  4. /scaffold-test でテストの観点を詰める",
  component:
    "\n次に行うこと:\n  1. README の placeholder を実装に合わせて具体化する\n  2. story に部品が表現する状態を足し、説明を書く\n  3. pnpm fix && pnpm lint:ci && pnpm check:ui --offline\n  4. /scaffold-test でテストの観点を詰める",
  adapter:
    "\n次に行うこと:\n  1. 呼び出す契約と正規化済みの型を書く\n  2. pnpm fix && pnpm lint:ci\n  3. /scaffold-test でテストの観点を詰める",
} as const satisfies Record<GenerationInput["kind"], string>;

console.log(NEXT_STEPS[input.kind]);

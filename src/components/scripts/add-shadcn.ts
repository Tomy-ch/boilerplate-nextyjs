import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { type Document, isMap, parseDocument } from "yaml";
import { z } from "zod";

import {
  CATALOG_HEADING,
  type CatalogHeading,
  COMPONENT_LAYER,
  type ComponentLayer,
  catalogHeadingSchema,
  componentDirectoryOf,
  componentLayerSchema,
  vendorImportsOf,
} from "./check-shadcn";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const manifestPath = resolve(repositoryRoot, "src/components/shadcn-manifest.yaml");
const componentReadmeTemplatePath = resolve(repositoryRoot, "src/components/component-template.md");
const shadcnPackagePath = resolve(repositoryRoot, "node_modules/shadcn/package.json");
const SHADCN_REGISTRY_URL = "https://ui.shadcn.com";
const componentsConfigPath = resolve(repositoryRoot, "components.json");
const UPSTREAM_REPOSITORY = "shadcn-ui/ui";
const UPSTREAM_API_URL = "https://api.github.com";
/** registry item が申告する `files[].path` は、上流ではこの直下に置かれる。 */
const UPSTREAM_REGISTRY_ROOT = "apps/v4";
/** Tailwind v4 向けの registry は、`components.json` の style にこの接尾辞を付けた名前で配信される。 */
const REGISTRY_STYLE_SUFFIX = "-v4";
const stagingDirectoryPath = resolve(
  repositoryRoot,
  "src/components",
  COMPONENT_LAYER.DESIGN_SYSTEM,
);
const ARGUMENT_SEPARATOR = "--";
const DRY_RUN_OPTION = "--dry-run";
const VIEW_OPTION = "--view";
const PATH_OPTION = "--path";
const SHORT_PATH_OPTION = "-p";
const OVERWRITE_OPTION = "--overwrite";
/** 目録の見出しを指定する、ラッパー自身のオプション。shadcn CLI へは渡さない。 */
const AS_OPTION = "--as";
/** 置く層を指定する、ラッパー自身のオプション。既定は design-system。 */
const LAYER_OPTION = "--layer";
const COMPONENT_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CATALOG_HEADINGS = Object.values(CATALOG_HEADING).join(" / ");
const COMPONENT_LAYERS = Object.values(COMPONENT_LAYER).join(" / ");

const registrySourceSchema = z.object({
  repository: z.string(),
  path: z.string(),
  /** 上流ファイルに対応する、このリポジトリ内のファイル。3-way merge の `ours` になる。 */
  localPath: z.string(),
  commit: z.string(),
  committedAt: z.iso.datetime(),
});

const COMPONENT_KIND = {
  /** registry から copy-in し、上流を追従対象として持ち続けるもの。 */
  COPY_IN: "copy-in",
  /** 上流に相当する item はあるが、こちらの要件に合わせて自前で実装し直したもの。 */
  REIMPLEMENTED: "reimplemented",
  /** 上流に相当する item が存在せず、最初から自前で作ったもの。 */
  ORIGINAL: "original",
  /** 検討したうえで作らないと決めたもの。実体を持たない。 */
  NOT_ADOPTED: "not-adopted",
} as const;

const presentComponentKindSchema = z.enum([
  COMPONENT_KIND.COPY_IN,
  COMPONENT_KIND.REIMPLEMENTED,
  COMPONENT_KIND.ORIGINAL,
]);

const presentComponentEntrySchema = z.object({
  kind: presentComponentKindSchema,
  /** 置く層。目的とは別の軸なので畳まない。 */
  layer: componentLayerSchema,
  /** component 目録で載る見出し。目的を表し、層は `directory` が持つ。 */
  as: catalogHeadingSchema,
  /** 上流の item 名。key は実体を指すラベルなので、対応を畳まずこちらで持つ。 */
  registryItem: z.string().optional(),
  /** 実体を置いた場所。上流と名前が違っても対応が壊れないよう、こちら側から宣言する。 */
  directory: z.string(),
  registry: z.url().optional(),
  addedAt: z.iso.datetime(),
  shadcnCliVersion: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  source: z.array(registrySourceSchema).optional(),
});

const notAdoptedEntrySchema = z.object({
  kind: z.literal(COMPONENT_KIND.NOT_ADOPTED),
  /** 上流の item 名。registry に無い候補を退けた場合は持たない。 */
  registryItem: z.string().optional(),
  /** 作らないと決めた理由。責務の引き取り先があるならそれを書く。 */
  reason: z.string(),
  /** 再検討を始める条件。条件を書けない「やらない」は判断ではなく先送りなので必須にする。 */
  revisitWhen: z.string(),
  decidedAt: z.iso.datetime(),
});

const componentManifestEntrySchema = z.discriminatedUnion("kind", [
  presentComponentEntrySchema,
  notAdoptedEntrySchema,
]);

const componentManifestSchema = z.object({
  schemaVersion: z.literal(1),
  components: z.record(z.string(), componentManifestEntrySchema),
});

const shadcnPackageSchema = z.object({
  version: z.string(),
});

const componentsConfigSchema = z.object({
  style: z.string(),
});

const registryItemSchema = z.object({
  dependencies: z.array(z.string()).optional(),
  files: z.array(z.object({ path: z.string() })).min(1),
});

const upstreamCommitSchema = z.object({
  sha: z.string(),
  commit: z.object({ committer: z.object({ date: z.iso.datetime() }) }),
});

const upstreamCommitsSchema = z.tuple([upstreamCommitSchema], upstreamCommitSchema);

type ComponentManifest = z.infer<typeof componentManifestSchema>;

/** 取り込んだ registry item の実体が、上流のどの commit 時点のものかを表す。 */
export type RegistrySource = z.infer<typeof registrySourceSchema>;

/** registry item から読み取った、追従判断に使う情報。 */
export type UpstreamItem = {
  dependencies?: readonly string[];
  source: readonly RegistrySource[];
};

/**
 * `pnpm add:ui` へ渡された引数を、部品名と shadcn CLI への引数に分けた形。
 *
 * @remarks
 * 一度に取り込めるのは一部品だけであり、`components` に二つ以上を含む呼び出しは実行前に弾かれる。
 */
export type ShadcnAddInvocation = {
  /** 取り込む部品名。要素が一つでない場合は不正な呼び出しとして扱う。 */
  components: string[];
  /** `--as=<見出し>` で指定された、component 目録の見出し。 */
  as?: string;
  /** `--layer=<層>` で指定された、置く層。省略時は design-system。 */
  layer?: string;
  /** `--dry-run` など、shadcn CLI へそのまま渡す引数。 */
  shadcnArguments: string[];
};

type ValidShadcnAddInvocation = ShadcnAddInvocation & {
  components: [string];
  as: CatalogHeading;
  layer: ComponentLayer;
};

/**
 * `pnpm add:ui` の引数を、追加対象・ラッパー自身のオプション・shadcn CLI へ渡す引数へ分離する。
 *
 * shadcn CLI のオプションは `--` より後ろに書く。これにより、manifest に記録する部品名と
 * CLI のオプション値を曖昧なく区別する。`--as` はラッパー自身のオプションなので `--` の手前に置く。
 *
 * @example
 * splitShadcnAddArguments(["button", "--as=action", "--", "--yes"])
 * // { components: ["button"], as: "action", shadcnArguments: ["--yes"] }
 */
export function splitShadcnAddArguments(arguments_: string[]): ShadcnAddInvocation {
  const separatorIndex = arguments_.indexOf(ARGUMENT_SEPARATOR);
  const wrapperArguments = separatorIndex === -1 ? arguments_ : arguments_.slice(0, separatorIndex);
  const shadcnArguments = separatorIndex === -1 ? [] : arguments_.slice(separatorIndex + 1);

  if (wrapperArguments.includes(AS_OPTION)) {
    throw new Error(`見出しは ${AS_OPTION}=<見出し> の形で指定してください。`);
  }

  if (wrapperArguments.includes(LAYER_OPTION)) {
    throw new Error(`層は ${LAYER_OPTION}=<層> の形で指定してください。`);
  }

  const asPrefix = `${AS_OPTION}=`;
  const layerPrefix = `${LAYER_OPTION}=`;
  const pick = (prefix: string): string | undefined =>
    wrapperArguments.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  const as = pick(asPrefix);
  const layer = pick(layerPrefix) ?? COMPONENT_LAYER.DESIGN_SYSTEM;
  const components = wrapperArguments.filter(
    (argument) => !argument.startsWith(asPrefix) && !argument.startsWith(layerPrefix),
  );

  if (components.length === 0) {
    throw new Error("追加する shadcn UI 部品を一つ以上指定してください。");
  }

  if (components.some((component) => component.startsWith("-"))) {
    throw new Error(
      "shadcn CLI のオプションは `--` の後ろへ指定してください。例: pnpm add:ui button -- --yes",
    );
  }

  return { components, as, layer, shadcnArguments };
}

/**
 * manifest の component エントリを、追加成功時点の来歴で upsert する。
 *
 * @remarks
 * key は実体を指すラベル、`registryItem` は上流の item 名である。copy-in した直後は両者が
 * 一致するが、取り込み後に実体を改名・移動した場合は key と `directory` を追随させ、
 * `registryItem` は上流の名前のまま据え置く。両者を 1 つのスロットへ畳むと、同じ item から
 * native / client の 2 実装を作ったときに表現できなくなる。
 */
export function componentManifestEntries(
  components: string[],
  as: CatalogHeading,
  layer: ComponentLayer,
  addedAt: string,
  shadcnCliVersion: string,
  dependencies: readonly string[],
  upstream?: UpstreamItem,
): ComponentManifest["components"] {
  return Object.fromEntries(
    components.map((component) => [
      component,
      {
        kind: COMPONENT_KIND.COPY_IN,
        layer,
        as,
        registryItem: component,
        directory: componentDirectory(component, as, layer),
        registry: SHADCN_REGISTRY_URL,
        addedAt,
        shadcnCliVersion,
        ...(dependencies.length === 0 ? {} : { dependencies: [...dependencies] }),
        ...(upstream?.source === undefined ? {} : { source: [...upstream.source] }),
      },
    ]),
  );
}

/** {@link componentManifestEntries} を既存の台帳へ重ねた結果を返す。 */
export function upsertComponentManifest(
  manifest: ComponentManifest,
  components: string[],
  as: CatalogHeading,
  layer: ComponentLayer,
  addedAt: string,
  shadcnCliVersion: string,
  dependencies: readonly string[],
  upstream?: UpstreamItem,
): ComponentManifest {
  const entries = componentManifestEntries(
    components,
    as,
    layer,
    addedAt,
    shadcnCliVersion,
    dependencies,
    upstream,
  );

  return {
    ...manifest,
    components: {
      ...manifest.components,
      ...entries,
    },
  };
}

async function runShadcnAdd(component: string, shadcnArguments: string[]): Promise<void> {
  const result = await new Promise<number | null>((resolveResult, reject) => {
    const child = spawn("pnpm", ["exec", "shadcn", "add", component, ...shadcnArguments], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", resolveResult);
  });

  if (result !== 0) {
    throw new Error(
      `shadcn add が exit ${String(result)} で終了しました。manifest は更新しません。`,
    );
  }
}

/** manifest へ宣言する、component ディレクトリのリポジトリ相対パス。 */
function componentDirectory(component: string, as: CatalogHeading, layer: ComponentLayer): string {
  return componentDirectoryOf(layer, as, component);
}

function componentSourcePath(component: string): string {
  return resolve(stagingDirectoryPath, `${component}.tsx`);
}

function componentDestinationPath(
  component: string,
  as: CatalogHeading,
  layer: ComponentLayer,
): string {
  return resolve(repositoryRoot, componentDirectory(component, as, layer), `${component}.tsx`);
}

function componentReadmePath(component: string, as: CatalogHeading, layer: ComponentLayer): string {
  return resolve(repositoryRoot, componentDirectory(component, as, layer), "README.md");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 取り込み済みの component の置き場。 */
type PackagedLocation = { name: string; as: CatalogHeading; layer: ComponentLayer };

/**
 * 取り込み済みの component が、いまどこに置かれているかを返す。
 *
 * @remarks
 * 依存部品の置き場は名前から決まらない。取り込み時に指定した層と見出しで決まり、あとから
 * 動かすこともあるため、実体を探して答える。見つからなければ未取り込みである。
 */
async function locatePackaged(component: string): Promise<PackagedLocation | undefined> {
  const candidates: PackagedLocation[] = [];
  for (const as of Object.values(CATALOG_HEADING)) {
    candidates.push({ name: component, as, layer: COMPONENT_LAYER.DESIGN_SYSTEM });
  }
  // design-system 以外は目的で割らないため、見出しはパスに現れない
  candidates.push({
    name: component,
    as: CATALOG_HEADING.DISPLAY,
    layer: COMPONENT_LAYER.PATTERNS,
  });
  candidates.push({
    name: component,
    as: CATALOG_HEADING.DISPLAY,
    layer: COMPONENT_LAYER.APP_STARTER,
  });
  const found = await Promise.all(
    candidates.map((c) => exists(componentDestinationPath(c.name, c.as, c.layer))),
  );
  return candidates.find((_, index) => found[index]);
}

async function moveComponentToPackage(
  component: string,
  as: CatalogHeading,
  layer: ComponentLayer,
): Promise<void> {
  const sourcePath = componentSourcePath(component);
  const destinationPath = componentDestinationPath(component, as, layer);
  await mkdir(dirname(destinationPath), { recursive: true });
  await rename(sourcePath, destinationPath);
}

/** shadcn CLI が依存として出力した、`design-system/` 直下のフラットな生成物の部品名を返す。 */
async function listFlatGeneratedComponents(): Promise<string[]> {
  const entries = await readdir(stagingDirectoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => basename(entry.name, ".tsx"));
}

/**
 * 取り込んだ component の依存 import を、package 済みの実体への相対パスへ向け直す。
 *
 * @remarks
 * 同じ見出しの下なら 1 段、違う見出しなら見出しを跨ぐぶんだけ深くなる。
 */
async function pointImportsAtPackagedComponents(
  component: string,
  as: CatalogHeading,
  layer: ComponentLayer,
  dependencies: readonly PackagedLocation[],
): Promise<void> {
  const path = componentDestinationPath(component, as, layer);
  const source = await readFile(path, "utf8");
  const rewritten = dependencies.reduce((current, dependency) => {
    const specifier = relative(
      dirname(path),
      componentDestinationPath(dependency.name, dependency.as, dependency.layer),
    ).replace(/\.tsx$/, "");
    const alias = `"@/components/${COMPONENT_LAYER.DESIGN_SYSTEM}/${dependency.name}"`;
    return current.replaceAll(alias, `"${specifier}"`);
  }, source);

  if (rewritten !== source) {
    await writeFile(path, rewritten);
  }
}

/**
 * shadcn CLI が依存として出力した生成物を整理し、package 済みの依存は実体へ寄せる。
 *
 * CLI はこのリポジトリの `<層>/<目的>/<name>/<name>.tsx` という配置を知らないため、依存部品を
 * `design-system/<name>.tsx` へ出力し、取り込んだ component からは
 * `@/components/design-system/<name>` を import する。
 * 放置すると実体の重複と解決しない import が同時に残り、次に typecheck を回した別の作業まで
 * 巻き込んで失敗する。
 *
 * @returns まだ package されていない依存の部品名。呼び出し元が利用者へ知らせる。
 */
async function reconcileGeneratedDependencies(
  component: string,
  as: CatalogHeading,
  layer: ComponentLayer,
): Promise<string[]> {
  const generated = await listFlatGeneratedComponents();
  const statuses = await Promise.all(
    generated.map(async (dependency) => ({
      name: dependency,
      at: await locatePackaged(dependency),
    })),
  );
  const packaged = statuses.flatMap((status) => (status.at === undefined ? [] : [status.at]));
  const unpackaged = statuses.filter((status) => status.at === undefined).map((s) => s.name);

  if (packaged.length === 0) return unpackaged;

  await Promise.all(packaged.map((dependency) => unlink(componentSourcePath(dependency.name))));
  await pointImportsAtPackagedComponents(component, as, layer, packaged);

  return unpackaged;
}

/** 新規 component には README テンプレートを置き、監査時に内容を具体化する。 */
async function copyComponentReadmeTemplate(
  component: string,
  as: CatalogHeading,
  layer: ComponentLayer,
): Promise<void> {
  const readmePath = componentReadmePath(component, as, layer);
  if (await exists(readmePath)) return;
  await copyFile(componentReadmeTemplatePath, readmePath);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`${url} が HTTP ${String(response.status)} を返しました。`);
  }
  return response.json();
}

/**
 * 取り込んだ registry item が、上流のどの commit 時点のものかを解決する。
 *
 * registry が配る JSON は生成物であり、内容は上流リポジトリのファイルそのものである。実体の
 * 位置は item 自身が `files[].path` として申告するため、こちらで組み立てない。commit を記録して
 * おくと、上流が変わったときに何が変わったかを差分として読める。CDN の `last-modified` は
 * キャッシュ充填時刻であり、`etag` は転送時の符号化で表現が変わるため、いずれも使わない。
 */
async function resolveUpstreamItem(
  component: string,
  as: CatalogHeading,
  layer: ComponentLayer,
): Promise<UpstreamItem> {
  const configSource = await readFile(componentsConfigPath, "utf8");
  const { style } = componentsConfigSchema.parse(JSON.parse(configSource));
  const itemUrl = `${SHADCN_REGISTRY_URL}/r/styles/${style}${REGISTRY_STYLE_SUFFIX}/${component}.json`;
  const item = registryItemSchema.parse(await fetchJson(itemUrl));

  const source = await Promise.all(
    item.files.map(async (file) => {
      const path = `${UPSTREAM_REGISTRY_ROOT}/${file.path}`;
      const commitsUrl = `${UPSTREAM_API_URL}/repos/${UPSTREAM_REPOSITORY}/commits?path=${encodeURIComponent(path)}&per_page=1`;
      const [latest] = upstreamCommitsSchema.parse(await fetchJson(commitsUrl));

      return {
        repository: UPSTREAM_REPOSITORY,
        path,
        localPath: `${componentDirectory(component, as, layer)}/${basename(file.path)}`,
        commit: latest.sha,
        committedAt: latest.commit.committer.date,
      };
    }),
  );

  return { dependencies: item.dependencies, source };
}

async function loadManifestDocument(): Promise<Document> {
  const source = await readFile(manifestPath, "utf8");
  const document = parseDocument(source);
  componentManifestSchema.parse(document.toJS());
  return document;
}

async function loadShadcnCliVersion(): Promise<string> {
  const source = await readFile(shadcnPackagePath, "utf8");
  return shadcnPackageSchema.parse(JSON.parse(source)).version;
}

function isDryRun(arguments_: string[]): boolean {
  return arguments_.some(
    (argument) => argument === DRY_RUN_OPTION || argument.startsWith(`${DRY_RUN_OPTION}=`),
  );
}

/** `--view` は生成物を書き出さない inspection-only の shadcn CLI オプション。 */
function isInspectionOnly(arguments_: string[]): boolean {
  return isDryRun(arguments_) || arguments_.some((argument) => argument === VIEW_OPTION);
}

function hasPathOption(arguments_: string[]): boolean {
  return arguments_.some(
    (argument) =>
      argument === PATH_OPTION ||
      argument.startsWith(`${PATH_OPTION}=`) ||
      argument === SHORT_PATH_OPTION,
  );
}

function hasOverwriteOption(arguments_: string[]): boolean {
  return arguments_.some(
    (argument) => argument === OVERWRITE_OPTION || argument.startsWith(`${OVERWRITE_OPTION}=`),
  );
}

function validateInvocation(
  invocation: ShadcnAddInvocation,
): asserts invocation is ValidShadcnAddInvocation {
  if (invocation.components.length !== 1) {
    throw new Error("一度に追加できる shadcn UI 部品は一つです。");
  }

  const component = invocation.components[0];
  if (!component || !COMPONENT_NAME_PATTERN.test(component)) {
    throw new Error("部品名は小文字 kebab-case で指定してください。");
  }

  // 見出しは取り込みの前に決めさせる。後回しにすると、実装が終わった時点で目録に載せる作業が
  // 残り、`check:ui` が落ちるまで気付けない。
  if (invocation.as === undefined) {
    throw new Error(
      `component 目録の見出しを ${AS_OPTION}=<見出し> で指定してください。指定できる見出し: ${CATALOG_HEADINGS}`,
    );
  }

  if (!catalogHeadingSchema.safeParse(invocation.as).success) {
    throw new Error(
      `${invocation.as} は component 目録の見出しにありません。指定できる見出し: ${CATALOG_HEADINGS}`,
    );
  }

  if (!componentLayerSchema.safeParse(invocation.layer).success) {
    throw new Error(
      `${invocation.layer} は component の層にありません。指定できる層: ${COMPONENT_LAYERS}`,
    );
  }

  if (hasPathOption(invocation.shadcnArguments)) {
    throw new Error("配置先はラッパーが移動するため、--path は指定できません。");
  }
}

/** shadcn add の成功後に、copy-in した部品の来歴を manifest へ記録する。 */
export async function addShadcnComponents(arguments_: string[]): Promise<void> {
  const invocation = splitShadcnAddArguments(arguments_);
  validateInvocation(invocation);
  const component = invocation.components[0];
  const destinationPath = componentDestinationPath(component, invocation.as, invocation.layer);
  const inspectionOnly = isInspectionOnly(invocation.shadcnArguments);
  if (
    (await exists(destinationPath)) &&
    !hasOverwriteOption(invocation.shadcnArguments) &&
    !inspectionOnly
  ) {
    throw new Error(
      `${component} は既に存在します。上書きする場合は \`pnpm add:ui ${component} -- --overwrite\` を実行してください。`,
    );
  }
  await runShadcnAdd(component, invocation.shadcnArguments);

  if (inspectionOnly) {
    process.stdout.write("inspection-only のため shadcn manifest は更新しません。\n");
    return;
  }

  await moveComponentToPackage(component, invocation.as, invocation.layer);
  const unpackagedDependencies = await reconcileGeneratedDependencies(
    component,
    invocation.as,
    invocation.layer,
  );
  await copyComponentReadmeTemplate(component, invocation.as, invocation.layer);

  const upstream = await resolveUpstreamItem(component, invocation.as, invocation.layer).catch(
    (error: unknown) => {
      process.stdout.write(
        `上流 commit を記録できませんでした: ${errorMessage(error)}\n` +
          "manifest の source は空のまま追加します。ネットワークを確認して取り込み直すと記録されます。\n",
      );
      return undefined;
    },
  );

  // 宣言する依存は、registry の宣言ではなく置いた実装が実際に import している package で決める。
  // 取り込み時の書き換えや自前実装で参照が変わるため、registry の宣言は実態と一致しない。
  const implementation = await readFile(
    resolve(
      repositoryRoot,
      componentDirectory(component, invocation.as, invocation.layer),
      `${component}.tsx`,
    ),
    "utf8",
  );

  const [document, shadcnCliVersion] = await Promise.all([
    loadManifestDocument(),
    loadShadcnCliVersion(),
  ]);
  // 既存エントリを書き戻さず、対象の 1 件だけを差し替える。文書ごと再シリアライズすると、
  // 台帳が持つ判断の経緯コメントが毎回消える。
  for (const [name, entry] of Object.entries(
    componentManifestEntries(
      invocation.components,
      invocation.as,
      invocation.layer,
      new Date().toISOString(),
      shadcnCliVersion,
      vendorImportsOf([implementation]),
      upstream,
    ),
  )) {
    document.setIn(["components", name], document.createNode(entry));
  }

  // 空の台帳は `components: {}` と flow 形式で書かれうる。そこへ足すと以降も flow のまま
  // 1 行に潰れて読めなくなるため、block 形式へ戻す。
  const components = document.get("components");
  /* istanbul ignore next -- schema が map であることを保証済みで、TS の絞り込みのためだけの分岐。 */
  if (isMap(components)) components.flow = false;
  await writeFile(manifestPath, document.toString());
  process.stdout.write(`shadcn manifest を更新しました: ${invocation.components.join(", ")}\n`);

  if (unpackagedDependencies.length > 0) {
    process.stdout.write(
      `未 package の依存が design-system/ 直下に残りました: ${unpackagedDependencies.join(", ")}。` +
        "先に該当部品を pnpm add:ui で取り込み・監査してから、この component を取り込み直してください。\n",
    );
  }
}

/* istanbul ignore next -- CLI のエントリポイントは pnpm add:ui の dry-run が実地で通す。 */
if (process.argv[1]?.endsWith("add-shadcn.ts")) {
  void addShadcnComponents(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}

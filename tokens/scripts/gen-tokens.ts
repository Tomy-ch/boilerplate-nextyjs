import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

type TokenValue = string | string[];

type Token = {
  $type: string;
  $value: TokenValue;
};

type TokenGroup = {
  [name: string]: Token | TokenGroup;
};

/** 1 つの系統が持つ配色 1 つぶんの semantic token。 */
type Scheme = {
  name: string;
  tokens: TokenGroup;
};

/** semantic token を供給する系統。既定の系統と既定の配色が先頭に来る。 */
export type Surface = {
  name: string;
  schemes: readonly Scheme[];
};

/** 宣言が効く範囲。`media` が null なら media query を伴わない。 */
type Scope = {
  media: string | null;
  selector: string;
};

const repositoryRoot = resolve(import.meta.dirname, "../..");
const primitivesPath = resolve(repositoryRoot, "tokens/primitives.json");
const themesDirectory = resolve(repositoryRoot, "tokens/themes");
const outputPath = resolve(repositoryRoot, "src/app/generated/tokens.css");
const breakpointOutputPath = resolve(repositoryRoot, "src/model/generated/breakpoint.ts");
const designTokenOutputPath = resolve(repositoryRoot, "src/model/generated/design-token.ts");

/**
 * 属性を何も置かない木に出る系統と配色。
 *
 * @remarks
 * 既定の系統は `:root` に出るため、`data-surface` を置かない木は必ずこの系統になります。ほかの
 * 系統はディレクトリを走査して見つけるので、系統を増やすのに生成側の変更は要りません。
 */
const defaultSurfaceName = "user";
const defaultSchemeName = "light";

function isToken(value: Token | TokenGroup): value is Token {
  return "$type" in value && "$value" in value;
}

function flattenTokens(group: TokenGroup, path: string[] = []): Array<[string[], Token]> {
  return Object.entries(group).flatMap(([name, value]) => {
    const nextPath = [...path, name];
    return isToken(value) ? [[nextPath, value]] : flattenTokens(value, nextPath);
  });
}

/**
 * CSS のカスタムプロパティ名は ident であり、`.` をそのまま置けない。`spacing.0.5` のような
 * 小数の段は `--spacing-0\.5` と綴る必要がある。Tailwind が生成する参照側も同じ綴りになる。
 */
function toVariableName(path: string[]): string {
  return path.join("-").replaceAll(".", String.raw`\.`);
}

function toCssValue(value: TokenValue): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

function toPrimitiveVariable(path: string[]): string {
  return `--${toVariableName(path)}`;
}

function toSemanticVariable(path: string[]): string {
  return `--semantic-${toVariableName(path)}`;
}

function toAliasVariable(path: string[]): string {
  return `--${toVariableName(path)}`;
}

/**
 * 値に含まれる `{color.cyan.300}` 形式の参照をすべて primitive の変数へ解決する。
 *
 * @remarks
 * 参照は値の一部としても書けます（`color-mix()` / `box-shadow`。`tokens/README.md`）。
 */
function resolveReferences(value: TokenValue, declared: ReadonlySet<string>): string {
  return toCssValue(value).replaceAll(/\{[^{}]+\}/g, (reference) =>
    toReference(reference, declared),
  );
}

/**
 * `{color.neutral.0}` 形式の参照 1 つを primitive の変数へ解決する。
 *
 * 参照は `.` 区切りだが、`spacing.0.5` のように段の名前自体が `.` を含むため区切りだけでは
 * 一意に定まらない。宣言済みの変数名と突き合わせて解決し、見つからなければ落とす。放置すると
 * 実在しない変数を指す `var()` が生成され、宣言ごと無効になって面や文字が消える。
 */
function toReference(value: string, declared: ReadonlySet<string>): string {
  const segments = value.slice(1, -1).split(".");
  for (let split = segments.length; split > 0; split--) {
    const candidate = toPrimitiveVariable([
      ...segments.slice(0, split - 1),
      segments.slice(split - 1).join("."),
    ]);
    if (declared.has(candidate)) return `var(${candidate})`;
  }
  throw new Error(`token 参照 ${value} に対応する primitive がありません`);
}

/**
 * 配色 1 つが効く範囲。
 *
 * 既定の配色は `:root` に置き、それ以外は「OS の設定」と「`data-theme` の明示指定」の二経路で
 * 発火させる。OS 側のブロックが `data-theme` の明示指定を打ち消さないよう、既定の配色を指定した
 * root は media query 側から除外する。
 *
 * 既定以外の配色は `screen` に限定する。media type を伴わない条件は print にも一致するため、
 * 暗い配色のまま印刷されてしまう。背景の塗りは印刷時に落ちるので、そのままだと白い紙に薄い文字が
 * 出る。既定の配色だけが `:root` に残ることで、印刷は常に既定の配色になる。
 */
function schemeScopes(scheme: string): Scope[] {
  if (scheme === defaultSchemeName) {
    return [{ media: null, selector: ":root" }];
  }

  return [
    {
      media: `screen and (prefers-color-scheme: ${scheme})`,
      selector: `:root:not([data-theme="${defaultSchemeName}"])`,
    },
    { media: "screen", selector: `:root[data-theme="${scheme}"]` },
  ];
}

/**
 * 系統と配色の組が効く範囲。
 *
 * 既定以外の系統は `data-surface` を置いた部分木に出す。既定の配色では `:root` に繋がず属性だけを
 * セレクタにする。繋ぐと詳細度が既定以外の配色と並び、どちらが勝つかが記述順まかせになる
 * （詳細度の積み上げは `tokens/README.md`）。
 */
function scopesFor(surface: string, scheme: string): Scope[] {
  return schemeScopes(scheme).map((scope) => {
    if (surface === defaultSurfaceName) return scope;

    const attribute = `[data-surface="${surface}"]`;

    return {
      media: scope.media,
      selector: scheme === defaultSchemeName ? attribute : `${scope.selector} ${attribute}`,
    };
  });
}

function renderBlock(scope: Scope, declarations: readonly string[]): string {
  const rule = [`${scope.selector} {`, ...declarations.map((line) => `  ${line}`), "}"];

  return scope.media === null
    ? rule.join("\n")
    : [`@media ${scope.media} {`, ...rule.map((line) => `  ${line}`), "}"].join("\n");
}

/**
 * 系統と配色の組 1 つぶんの宣言。
 *
 * @remarks
 * `color-scheme` は配色の軸の宣言なので、既定の系統にだけ出します（`tokens/README.md`）。
 * 宣言しないと、配色を切り替えてもスクロールバー・フォーム部品・キャンバスの既定描画が
 * 既定の配色のまま取り残されます。
 */
function declarationsFor(surface: string, scheme: Scheme, declared: ReadonlySet<string>): string[] {
  const colorScheme = surface === defaultSurfaceName ? [`color-scheme: ${scheme.name};`] : [];
  const tokens = flattenTokens(scheme.tokens).map(
    ([path, token]) => `${toSemanticVariable(path)}: ${resolveReferences(token.$value, declared)};`,
  );

  return [...colorScheme, ...tokens];
}

/**
 * breakpoint の段を TypeScript の定数として生成する。
 *
 * @remarks
 * CSS 側は `@theme` の `--breakpoint-*` を Tailwind が読み、`lg:` などの variant になります。JS から
 * media query を組む経路はそこを読めないため、同じ SSOT から両方を出します。片方を手で書くと、段を
 * 差し替えたときに CSS と JS で境界がずれ、両方出る幅か両方消える幅ができます。
 */
export function generateBreakpointTs(primitives: TokenGroup): string {
  const group = primitives["breakpoint"];

  if (group === undefined || isToken(group)) {
    throw new Error("primitives.json に breakpoint の段がありません");
  }

  const entries = flattenTokens(group).map(
    ([path, token]) => `  ${toObjectKey(path.join("-"))}: "${toCssValue(token.$value)}",`,
  );

  return [
    "// このファイルは tokens/scripts/gen-tokens.ts から生成されます。手編集禁止。",
    "",
    "/** 段の名前と幅。CSS の `--breakpoint-*` と同じ SSOT から生成される。 */",
    "export const BREAKPOINT = {",
    ...entries,
    "} as const;",
    "",
  ].join("\n");
}

/** 名前が識別子として妥当なら引用符を付けない。biome の整形結果と綴りを揃える。 */
function toObjectKey(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : `"${name}"`;
}

/**
 * token の名前を TypeScript の定数として生成する。
 *
 * @remarks
 * カタログが名前を手で並べると、token を足したときに目録だけが古いまま残ります。値は配色と
 * 系統で変わるので持ちません。実際の値は、表示する側が実行時に CSS から読みます。
 */
export function generateDesignTokenTs(
  primitives: TokenGroup,
  surfaces: readonly Surface[],
): string {
  const defaultScheme = surfaces[0]?.schemes[0];

  if (defaultScheme === undefined) {
    throw new Error(`既定の系統 "${defaultSurfaceName}" が tokens/themes にありません`);
  }

  const render = (group: TokenGroup): string[] =>
    Object.entries(group).flatMap(([name, value]) => {
      if (isToken(value)) return [];
      const names = flattenTokens(value).map(([path]) => `    "${path.join("-")}",`);

      return [`  ${toObjectKey(name)}: [`, ...names, "  ],"];
    });

  return [
    "// このファイルは tokens/scripts/gen-tokens.ts から生成されます。手編集禁止。",
    "",
    "/** 意味トークンの名前。値は配色と系統で変わるため、表示する側が実行時に CSS から読む。 */",
    "export const SEMANTIC_TOKEN = {",
    ...render(defaultScheme.tokens),
    "} as const;",
    "",
    "/** 生スケールの名前。意味トークンが参照する側で、部品からは直接参照しない。 */",
    "export const PRIMITIVE_TOKEN = {",
    ...render(primitives),
    "} as const;",
    "",
  ].join("\n");
}

/**
 * W3C Design Tokens 形式の入力から Tailwind v4 用 CSS を生成する。
 *
 * @remarks
 * `surfaces` の先頭が既定の系統でないとき、その系統が配色を 1 つも持たないとき、参照が宣言済みの
 * primitive へ解決できないときは例外を投げます。
 */
export function generateTokensCss(primitives: TokenGroup, surfaces: readonly Surface[]): string {
  const primitivePaths = flattenTokens(primitives);
  const declared = new Set(primitivePaths.map(([path]) => toPrimitiveVariable(path)));
  const primitiveDeclarations = primitivePaths.map(
    ([path, token]) => `  ${toPrimitiveVariable(path)}: ${toCssValue(token.$value)};`,
  );
  const [defaultSurface] = surfaces;
  const defaultScheme = defaultSurface?.schemes[0];

  if (defaultSurface === undefined || defaultScheme === undefined) {
    throw new Error(`既定の系統 "${defaultSurfaceName}" が tokens/themes にありません`);
  }

  const aliasDeclarations = flattenTokens(defaultScheme.tokens).map(([path]) => {
    return `  ${toAliasVariable(path)}: var(${toSemanticVariable(path)});`;
  });

  // 記述順が詳細度の同点を裁く。既定の系統を先に出すことで、あとに来る系統が同じ木で勝つ
  const blocks = surfaces.flatMap((surface) =>
    surface.schemes.flatMap((scheme) =>
      scopesFor(surface.name, scheme.name).map((scope) =>
        renderBlock(scope, declarationsFor(surface.name, scheme, declared)),
      ),
    ),
  );

  return [
    "/* このファイルは tokens/scripts/gen-tokens.ts から生成されます。手編集禁止。 */",
    "",
    "@theme {",
    ...primitiveDeclarations,
    "}",
    "",
    "@theme inline {",
    ...aliasDeclarations,
    "}",
    "",
    ...blocks,
    "",
  ].join("\n");
}

async function readTokenFile(path: string): Promise<TokenGroup> {
  return JSON.parse(await readFile(path, "utf8")) as TokenGroup;
}

/** 既定の名前を先頭に、残りを名前順に並べる。 */
function byDefaultFirst(defaultName: string): (a: string, b: string) => number {
  return (a, b) => Number(b === defaultName) - Number(a === defaultName) || a.localeCompare(b);
}

/**
 * すべての系統が同じ配色を宣言していることを確かめる。
 *
 * @remarks
 * 配色を 1 つ欠いた系統は、その配色のときブロックが出ません。壊れ方は {@link assertSameTokens}
 * と同じで、粒度がファイル単位になります。既定の系統だけを検査しても、欠けているのがほかの
 * 系統なら素通りします。
 */
function assertSameSchemes(surfaces: readonly Surface[], reference: Surface): void {
  const expected = reference.schemes.map((scheme) => scheme.name).join();

  for (const surface of surfaces) {
    const actual = surface.schemes.map((scheme) => scheme.name).join();

    if (actual !== expected) {
      throw new Error(
        `tokens/themes/${surface.name} の配色が ${reference.name} と一致しません（${expected} が要ります）`,
      );
    }
  }
}

/**
 * すべての系統と配色が同じ token を宣言していることを確かめる。
 *
 * @remarks
 * 欠けた token は宣言が無いだけで済まず、カスケードで既定の値を引き継ぎます（壊れ方は
 * `tokens/README.md`）。
 */
function assertSameTokens(surfaces: readonly Surface[], reference: Scheme): void {
  const expected = flattenTokens(reference.tokens)
    .map(([path]) => path.join("."))
    .sort()
    .join();

  for (const surface of surfaces) {
    for (const scheme of surface.schemes) {
      const actual = flattenTokens(scheme.tokens)
        .map(([path]) => path.join("."))
        .sort()
        .join();

      if (actual !== expected) {
        throw new Error(
          `tokens/themes/${surface.name}/${scheme.name}.json の token が ${defaultSurfaceName}/${defaultSchemeName}.json と一致しません`,
        );
      }
    }
  }
}

/**
 * `tokens/themes/<系統>/<配色>.json` を読む。
 *
 * @remarks
 * 既定の系統と既定の配色を先頭へ置きます。この順序は生成物の意味の一部です
 * （`generateTokensCss` が記述順で詳細度の同点を裁きます）。
 */
async function readSurfaces(): Promise<Surface[]> {
  const entries = await readdir(themesDirectory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(byDefaultFirst(defaultSurfaceName));

  const surfaces = await Promise.all(
    names.map(async (name) => {
      const files = await readdir(resolve(themesDirectory, name));
      const schemes = files
        .filter((file) => extname(file) === ".json")
        .map((file) => basename(file, ".json"))
        .sort(byDefaultFirst(defaultSchemeName));

      return {
        name,
        schemes: await Promise.all(
          schemes.map(async (scheme) => ({
            name: scheme,
            tokens: await readTokenFile(resolve(themesDirectory, name, `${scheme}.json`)),
          })),
        ),
      };
    }),
  );

  const [defaultSurface] = surfaces;

  if (defaultSurface?.name !== defaultSurfaceName) {
    throw new Error(`既定の系統 "${defaultSurfaceName}" が tokens/themes にありません`);
  }

  const [defaultScheme] = defaultSurface.schemes;

  if (defaultScheme?.name !== defaultSchemeName) {
    throw new Error(
      `既定の配色 "${defaultSchemeName}" が tokens/themes/${defaultSurfaceName} にありません`,
    );
  }

  assertSameSchemes(surfaces, defaultSurface);
  assertSameTokens(surfaces, defaultScheme);

  return surfaces;
}

/** token SSOT を読み込み、生成物との一致を検証または生成する。 */
export async function generateOrCheckTokens(checkOnly: boolean): Promise<void> {
  const [primitives, surfaces] = await Promise.all([readTokenFile(primitivesPath), readSurfaces()]);
  const generated = [
    [outputPath, generateTokensCss(primitives, surfaces)],
    [breakpointOutputPath, generateBreakpointTs(primitives)],
    [designTokenOutputPath, generateDesignTokenTs(primitives, surfaces)],
  ] as const;

  if (!checkOnly) {
    await Promise.all(
      generated.map(async ([path, content]) => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content);
      }),
    );
    return;
  }

  const current = await Promise.all(generated.map(([path]) => readFile(path, "utf8")));

  if (current.some((content, index) => content !== generated[index]?.[1])) {
    throw new Error(
      "design token の生成物が SSOT と一致しません。pnpm gen:tokens を実行してください。",
    );
  }
}

/* istanbul ignore next -- CLI entry。起動経路は pnpm gen:tokens / check:tokens が実地で通す。 */
if (process.argv[1]?.endsWith("gen-tokens.ts")) {
  void generateOrCheckTokens(process.argv.includes("--check")).catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
}

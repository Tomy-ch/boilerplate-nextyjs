"use client";

import {
  type ComponentProps,
  type ComponentType,
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useId,
  useMemo,
} from "react";
import type { TooltipValueType } from "recharts";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/components/cn";

import {
  CHART_INDICATOR,
  CHART_THEME_SELECTORS,
  type ChartIndicator,
  type ChartTheme,
} from "./chart.definition";

const INITIAL_DIMENSION = { width: 320, height: 200 } as const;

type TooltipNameType = number | string;

/** CSS 変数を含む style 指定。React の型は custom property を含まないため、ここで補う。 */
type StyleWithCustomProperties = CSSProperties & {
  [key: `--${string}`]: string | undefined;
};

/**
 * 系列ごとの表示名・色・アイコンの定義。
 *
 * @remarks
 * key は data の系列名と一致させる。`color` は単色、`theme` は配色モードごとの色を指定する。
 * どちらも `--color-<key>` という CSS 変数として `ChartContainer` の配下へ配られるため、
 * recharts の `fill` / `stroke` から `var(--color-<key>)` で参照できる。
 */
export type ChartConfig = Record<
  string,
  {
    label?: ReactNode;
    icon?: ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<ChartTheme, string> })
>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = createContext<ChartContextProps | null>(null);

function useChart(): ChartContextProps {
  const context = useContext(ChartContext);

  if (!context) {
    throw new Error("useChart は ChartContainer の配下でのみ使えます。");
  }

  return context;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringField(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];

  return typeof value === "string" ? value : undefined;
}

/**
 * recharts が渡す payload から、対応する系列の定義を取り出す。
 *
 * payload は recharts の内部形なので、形を確かめてから読む。`key` の指す値が payload 側に
 * 文字列としてあればそれを定義名に使い、無ければ `key` 自体を定義名として扱う。
 */
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string,
): ChartConfig[string] | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const nestedPayload = isRecord(payload["payload"]) ? payload["payload"] : undefined;
  const configKey =
    readStringField(payload, key) ??
    (nestedPayload ? readStringField(nestedPayload, key) : undefined) ??
    key;

  return configKey in config ? config[configKey] : config[key];
}

/**
 * 系列の色を CSS 変数として配る `style` 要素。
 *
 * @remarks
 * `ChartContainer` が内部で描画するため、通常は直接指定しない。`config` の色は開発者が書く定数で
 * あることを前提に、そのまま stylesheet へ載せる。利用者入力や API 応答を色として渡さない。
 *
 * @param props.id - 変数を適用する `data-chart` の値。
 * @param props.config - 系列ごとの色定義。
 * @see Storybook `Display/Chart`
 */
export function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.theme ?? item.color);

  if (colorConfig.length === 0) {
    return null;
  }

  const css = CHART_THEME_SELECTORS.map(([theme, prefix]) => {
    const declarations = colorConfig
      .map(([key, itemConfig]) => {
        const color = itemConfig.theme?.[theme] ?? itemConfig.color;

        return color ? `  --color-${key}: ${color};` : null;
      })
      .filter((declaration) => declaration !== null)
      .join("\n");

    return `${prefix} [data-chart=${id}] {\n${declarations}\n}`;
  }).join("\n");

  // biome-ignore lint/security/noDangerouslySetInnerHtml: 系列色を CSS 変数として配る唯一の手段。値の制約は `ChartStyle` の doc が持つ。
  return <style dangerouslySetInnerHTML={{ __html: css }} data-slot="chart-style" />; // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
}

/**
 * 系列定義と描画領域を与える chart の root。
 *
 * @remarks
 * recharts が描画に DOM の実寸を必要とするため hydration が必要で、Server Component からは直接
 * render できない。データの取得と集計は持たないため、描画に必要な形へ整えた配列を呼び出し元が渡す。
 *
 * chart は形と色で情報を伝えるため、それだけでは読み取れない利用者がいる。同じ内容へ到達できる
 * 数値表や要約を必ず併置し、chart を唯一の伝達手段にしない。
 *
 * `config` の各 key は data の系列名と一致させる。色は `--color-<key>` の CSS 変数として配下へ
 * 配られるので、recharts 側では `var(--color-<key>)` で参照する。
 *
 * @example
 * ```tsx
 * <ChartContainer config={{ visits: { label: "訪問", color: "var(--semantic-color-foreground)" } }}>
 *   <BarChart data={data}>
 *     <Bar dataKey="visits" fill="var(--color-visits)" />
 *   </BarChart>
 * </ChartContainer>
 * ```
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.config - 系列ごとの表示名・色・アイコン。
 * @param props.initialDimension - 実寸が確定するまでに使う描画領域の大きさ。
 * @see Storybook `Display/Chart`
 */
export function ChartContainer({
  id,
  className,
  children,
  config,
  initialDimension = INITIAL_DIMENSION,
  ...props
}: ComponentProps<"div"> & {
  config: ChartConfig;
  children: ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  initialDimension?: { width: number; height: number };
}) {
  const uniqueId = useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className,
        )}
        data-chart={chartId}
        data-slot="chart"
        {...props}
      >
        <ChartStyle config={config} id={chartId} />
        <RechartsPrimitive.ResponsiveContainer initialDimension={initialDimension}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

/**
 * hover した位置の系列値を表示する tooltip。
 *
 * @remarks
 * recharts の `Tooltip` をそのまま公開している。中身は `content` へ `ChartTooltipContent` を
 * 渡して描画する。
 *
 * @see Storybook `Display/Chart`
 */
export const ChartTooltip = RechartsPrimitive.Tooltip;

/**
 * tooltip の中身。系列名・色の印・値を並べる。
 *
 * @remarks
 * `ChartContainer` の配下でのみ使える。pointer を合わせている間だけ現れるため、touch 環境と
 * keyboard 利用者には到達できない。ここでしか読めない情報を置かず、同じ内容へ到達できる表や
 * 要約を feature 側に用意する。
 *
 * @param props - recharts `Tooltip` の props と native `div` 属性に、以下を加えたもの。
 * @param props.indicator - 系列に添える印の形。
 * @param props.hideLabel - 見出し行を隠すか。
 * @param props.hideIndicator - 系列の印を隠すか。
 * @param props.nameKey - 系列名として読む payload の key。
 * @param props.labelKey - 見出しとして読む payload の key。
 * @see Storybook `Display/Chart`
 */
export function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = CHART_INDICATOR.DOT,
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: ComponentProps<typeof RechartsPrimitive.Tooltip> &
  ComponentProps<"div"> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: ChartIndicator;
    nameKey?: string;
    labelKey?: string;
  } & Omit<
    RechartsPrimitive.DefaultTooltipContentProps<TooltipValueType, TooltipNameType>,
    "accessibilityLayer"
  >) {
  const { config } = useChart();

  const tooltipLabel = useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }

    const [item] = payload;
    const key = `${labelKey ?? item?.dataKey ?? item?.name ?? "value"}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value =
      !labelKey && typeof label === "string" ? (config[label]?.label ?? label) : itemConfig?.label;

    if (labelFormatter) {
      return (
        <div className={cn("font-emphasis", labelClassName)}>{labelFormatter(value, payload)}</div>
      );
    }

    if (!value) {
      return null;
    }

    return <div className={cn("font-emphasis", labelClassName)}>{value}</div>;
  }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

  if (!active || !payload?.length) {
    return null;
  }

  const nestLabel = payload.length === 1 && indicator !== CHART_INDICATOR.DOT;

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className,
      )}
      data-slot="chart-tooltip-content"
    >
      {nestLabel ? null : (tooltipLabel ?? null)}
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.type !== "none")
          .map((item, index) => {
            const key = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const indicatorColor = color ?? item.payload?.fill ?? item.color;
            const indicatorStyle: StyleWithCustomProperties = {
              "--color-bg": indicatorColor,
              "--color-border": indicatorColor,
            };

            return (
              <div
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === CHART_INDICATOR.DOT && "items-center",
                )}
                key={key}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? <itemConfig.icon /> : null}
                    {itemConfig?.icon || hideIndicator ? null : (
                      <div
                        className={cn(
                          "shrink-0 rounded-xs border-(--color-border) bg-(--color-bg)",
                          {
                            "h-2.5 w-2.5": indicator === CHART_INDICATOR.DOT,
                            "w-1": indicator === CHART_INDICATOR.LINE,
                            "w-0 border-[1.5px] border-dashed bg-transparent":
                              indicator === CHART_INDICATOR.DASHED,
                            "my-0.5": nestLabel && indicator === CHART_INDICATOR.DASHED,
                          },
                        )}
                        style={indicatorStyle}
                      />
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center",
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label ?? item.name}
                        </span>
                      </div>
                      {item.value == null ? null : (
                        <span className="font-mono font-emphasis text-foreground tabular-nums">
                          {typeof item.value === "number"
                            ? item.value.toLocaleString()
                            : String(item.value)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

/**
 * 系列名と色の対応を示す凡例。
 *
 * @remarks
 * recharts の `Legend` をそのまま公開している。中身は `content` へ `ChartLegendContent` を
 * 渡して描画する。
 *
 * @see Storybook `Display/Chart`
 */
export const ChartLegend = RechartsPrimitive.Legend;

/**
 * 凡例の中身。系列の印と表示名を並べる。
 *
 * @remarks
 * `ChartContainer` の配下でのみ使える。色だけで系列を区別させないため、表示名は必ず添える。
 *
 * @param props - native `div` 属性と recharts の凡例 props に、以下を加えたもの。
 * @param props.hideIcon - 系列のアイコンを隠すか。
 * @param props.nameKey - 系列名として読む payload の key。
 * @see Storybook `Display/Chart`
 */
export function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: ComponentProps<"div"> & {
  hideIcon?: boolean;
  nameKey?: string;
} & RechartsPrimitive.DefaultLegendContentProps) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
      data-slot="chart-legend-content"
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = `${nameKey ?? item.dataKey ?? "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);

          return (
            <div
              className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              key={key}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-xs"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {itemConfig?.label}
            </div>
          );
        })}
    </div>
  );
}

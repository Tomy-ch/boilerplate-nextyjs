const DEFAULT_LIST_ITEM_VARIANT = "default";
const OUTLINE_LIST_ITEM_VARIANT = "outline";
const MUTED_LIST_ITEM_VARIANT = "muted";
const DEFAULT_LIST_ITEM_SIZE = "default";
const SMALL_LIST_ITEM_SIZE = "sm";
const DEFAULT_LIST_ITEM_MEDIA_VARIANT = "default";
const ICON_LIST_ITEM_MEDIA_VARIANT = "icon";
const IMAGE_LIST_ITEM_MEDIA_VARIANT = "image";

/**
 * 行の面の見せ方を表す定数。
 *
 * @see Storybook `Display/List`
 */
export const LIST_ITEM_VARIANT: Readonly<{
  DEFAULT: "default";
  OUTLINE: "outline";
  MUTED: "muted";
}> = {
  DEFAULT: DEFAULT_LIST_ITEM_VARIANT,
  OUTLINE: OUTLINE_LIST_ITEM_VARIANT,
  MUTED: MUTED_LIST_ITEM_VARIANT,
};

/**
 * 行の余白の大きさを表す定数。
 *
 * @see Storybook `Display/List`
 */
export const LIST_ITEM_SIZE: Readonly<{
  DEFAULT: "default";
  SMALL: "sm";
}> = {
  DEFAULT: DEFAULT_LIST_ITEM_SIZE,
  SMALL: SMALL_LIST_ITEM_SIZE,
};

/**
 * 行の先頭に置く媒体の種類を表す定数。
 *
 * @see Storybook `Display/List`
 */
export const LIST_ITEM_MEDIA_VARIANT: Readonly<{
  DEFAULT: "default";
  ICON: "icon";
  IMAGE: "image";
}> = {
  DEFAULT: DEFAULT_LIST_ITEM_MEDIA_VARIANT,
  ICON: ICON_LIST_ITEM_MEDIA_VARIANT,
  IMAGE: IMAGE_LIST_ITEM_MEDIA_VARIANT,
};

/** {@link LIST_ITEM_VARIANT} のいずれか。 */
export type ListItemVariant = (typeof LIST_ITEM_VARIANT)[keyof typeof LIST_ITEM_VARIANT];

/** {@link LIST_ITEM_SIZE} のいずれか。 */
export type ListItemSize = (typeof LIST_ITEM_SIZE)[keyof typeof LIST_ITEM_SIZE];

/** {@link LIST_ITEM_MEDIA_VARIANT} のいずれか。 */
export type ListItemMediaVariant =
  (typeof LIST_ITEM_MEDIA_VARIANT)[keyof typeof LIST_ITEM_MEDIA_VARIANT];

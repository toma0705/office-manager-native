export type NamedSize = "small" | "medium" | "large";

type SizeMap = Record<NamedSize, number>;

const NAMED_SIZE_MAP: SizeMap = Object.freeze({
  small: 20,
  medium: 28,
  large: 48,
});

export const namedSizeMap: Readonly<SizeMap> = NAMED_SIZE_MAP;

export const normalizeSize = (
  size: number | NamedSize | undefined,
  fallback: number = NAMED_SIZE_MAP.medium
): number => {
  if (typeof size === "number") {
    return Number.isFinite(size) ? size : fallback;
  }

  if (!size) {
    return fallback;
  }

  const mapped = NAMED_SIZE_MAP[size as NamedSize];
  return typeof mapped === "number" ? mapped : fallback;
};

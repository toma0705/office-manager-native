import React, { useEffect } from "react";
import { ActivityIndicator, type ActivityIndicatorProps } from "react-native";
import { type NamedSize, namedSizeMap } from "@/utils/size";

type SpinnerSize = number | NamedSize;

type SpinnerProps = Omit<ActivityIndicatorProps, "size"> & {
  size?: SpinnerSize;
};

const DEFAULT_SIZE: SpinnerSize = "medium";

export const Spinner: React.FC<SpinnerProps> = ({
  size = DEFAULT_SIZE,
  ...rest
}) => {
  const fallback =
    typeof DEFAULT_SIZE === "number"
      ? DEFAULT_SIZE
      : namedSizeMap[DEFAULT_SIZE];
  const normalizedSize = normalizeSize(size, fallback);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[Spinner] size prop", size, "normalized", normalizedSize);
  }, [size, normalizedSize]);

  return <ActivityIndicator {...rest} size={normalizedSize} />;
};

export const normalizeSize = (
  size: number | NamedSize | undefined,
  fallback: number = namedSizeMap.medium
): number => {
  if (typeof size === "number" && Number.isFinite(size)) {
    return size;
  }
  if (typeof size === "string") {
    const mappedSize = namedSizeMap[size as NamedSize];
    if (typeof mappedSize === "number") {
      return mappedSize;
    }
  }
  return fallback;
};

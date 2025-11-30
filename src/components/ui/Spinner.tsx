import React from "react";
import { View, type ActivityIndicatorProps } from "react-native";
import { type NamedSize, namedSizeMap } from "@/utils/size";

type SpinnerSize = number | NamedSize;

type SpinnerProps = Omit<ActivityIndicatorProps, "size"> & {
  size?: SpinnerSize;
};

const DEFAULT_SIZE: SpinnerSize = namedSizeMap.medium;

export const Spinner: React.FC<SpinnerProps> = ({ size = DEFAULT_SIZE }) => {
  const fallback =
    typeof DEFAULT_SIZE === "number" ? DEFAULT_SIZE : namedSizeMap.medium;
  const normalizedSize = normalizeSize(size, fallback);

  const dimension = normalizeSize(normalizedSize, fallback);

  return <View style={{ width: dimension, height: dimension }} />;
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

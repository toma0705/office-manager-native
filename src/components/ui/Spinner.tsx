import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { type NamedSize, namedSizeMap } from "@/utils/size";

type SpinnerSize = number | NamedSize;

type SpinnerProps = {
  size?: SpinnerSize;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

const DEFAULT_SIZE: SpinnerSize = namedSizeMap.medium;

export const Spinner: React.FC<SpinnerProps> = ({
  size = DEFAULT_SIZE,
  color = "#7bc062",
  style,
  accessibilityLabel = "読み込み中",
  testID,
}) => {
  const fallback =
    typeof DEFAULT_SIZE === "number" ? DEFAULT_SIZE : namedSizeMap.medium;
  const normalizedSize = normalizeSize(size, fallback);
  // Debug logging to trace size normalization
  // eslint-disable-next-line no-console
  console.log(
    "[DEBUG Spinner] size prop=",
    size,
    "=> normalized=",
    normalizedSize
  );
  if (typeof normalizedSize !== "number") {
    // eslint-disable-next-line no-console
    console.error(
      "[DEBUG Spinner] Non-numeric size detected",
      size,
      normalizedSize
    );
  }
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [rotation]);

  const spinnerStyle = {
    width: normalizedSize,
    height: normalizedSize,
    borderRadius: normalizedSize / 2,
    borderWidth: Math.max(2, normalizedSize / 10),
    borderColor: color,
    borderTopColor: "transparent",
  } satisfies ViewStyle;

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      testID={testID}
      style={[
        styles.base,
        spinnerStyle,
        { transform: [{ rotate: spin }] },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});

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

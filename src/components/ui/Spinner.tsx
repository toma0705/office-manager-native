import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "@/theme/colors";
import { type NamedSize, namedSizeMap, normalizeSize } from "@/utils/size";

type SpinnerSize = number | NamedSize;

type SpinnerProps = {
  size?: SpinnerSize;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/** くるくる回る読み込み中の表示 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = namedSizeMap.medium,
  color = colors.primary,
  style,
  accessibilityLabel = "読み込み中",
  testID,
}) => {
  const normalizedSize = normalizeSize(size);
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

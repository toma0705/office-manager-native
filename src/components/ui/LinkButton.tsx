import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors } from "@/theme/colors";

type Props = {
  title: string;
  onPress: () => void;
  underline?: boolean;
  center?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export const LinkButton: React.FC<Props> = ({
  title,
  onPress,
  underline = true,
  center = false,
  style,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        pressed && styles.pressed,
        center && styles.center,
        style,
      ]}
    >
      <Text style={[styles.text, underline ? styles.underline : null]}>
        {title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 8,
  },
  center: {
    alignItems: "center",
  },
  text: {
    color: colors.primaryDark,
    fontWeight: "600",
    fontSize: 15,
  },
  underline: {
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.7,
  },
});

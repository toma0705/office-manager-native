import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/theme/colors";

type Props = {
  title: string;
  onPress: () => void;
  center?: boolean;
};

export const LinkButton: React.FC<Props> = ({
  title,
  onPress,
  center = false,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        pressed && styles.pressed,
        center && styles.center,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
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
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.7,
  },
});

import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { colors } from "@/theme/colors";

type Props = ViewProps & {
  maxWidth?: number;
};

export const CardLayout: React.FC<Props> = ({
  children,
  style,
  maxWidth = 400,
  ...props
}) => {
  return (
    <View style={[styles.card, { maxWidth }, style]} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    alignSelf: "center",
    backgroundColor: colors.white,
    padding: 24,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
    width: "100%",
  },
});

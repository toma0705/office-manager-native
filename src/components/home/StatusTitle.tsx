import React from "react";
import { StyleSheet, Text } from "react-native";
import { colors } from "@/theme/colors";

type Props = {
  entered: boolean;
};

export const StatusTitle: React.FC<Props> = ({ entered }) => {
  return (
    <Text style={[styles.title, entered ? styles.entered : styles.exited]}>
      {entered ? "入室中" : "退出中"}
    </Text>
  );
};

const styles = StyleSheet.create({
  title: {
    textAlign: "center",
    fontSize: 32,
    fontWeight: "800",
    marginVertical: 16,
  },
  entered: {
    color: colors.primary,
  },
  exited: {
    color: colors.danger,
  },
});

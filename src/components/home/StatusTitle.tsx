import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

type Props = {
  entered: boolean;
};

export const StatusTitle: React.FC<Props> = ({ entered }) => {
  return (
    <View
      style={[styles.badge, entered ? styles.badgeEntered : styles.badgeExited]}
    >
      <Text
        style={[styles.title, entered ? styles.enteredText : styles.exitedText]}
      >
        {entered ? "入室中" : "退室中"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 999,
    borderWidth: 2,
    gap: 12,
    shadowColor: "rgba(0,0,0,0.25)",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  badgeEntered: {
    backgroundColor: "#e8fbe9",
    borderColor: colors.primary,
  },
  badgeExited: {
    backgroundColor: "#fdeaea",
    borderColor: colors.danger,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  enteredText: {
    color: colors.primaryDark,
  },
  exitedText: {
    color: colors.danger,
  },
});

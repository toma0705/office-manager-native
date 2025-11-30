import React from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { colors } from "@/theme/colors";

type Props = ScrollViewProps & {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export const PageContainer: React.FC<Props> = ({
  children,
  contentStyle,
  ...props
}) => {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        contentContainerStyle={[styles.container, contentStyle]}
        {...props}
      >
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: "stretch",
    justifyContent: "center",
  },
  inner: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    gap: 16,
  },
});

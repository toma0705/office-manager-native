import React from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  Text,
} from "react-native";
import { colors } from "@/theme/colors";

type Props = TextInputProps & {
  label?: string;
  errorText?: string;
};

export const Input: React.FC<Props> = ({
  label,
  errorText,
  style,
  ...props
}) => {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.mutedText}
        {...props}
        style={[styles.input, style]}
      />
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontWeight: "600",
    marginBottom: 6,
    color: colors.text,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.text,
  },
  error: {
    marginTop: 6,
    color: colors.danger,
    fontSize: 12,
    fontWeight: "500",
  },
});

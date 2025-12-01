import React, { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
  View,
} from "react-native";
import { colors } from "@/theme/colors";
import { Spinner } from "./Spinner";
import { namedSizeMap } from "@/utils/size";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = {
  title: string;
  onPress?: () => void | Promise<void>;
  variant?: Variant;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  leftIcon?: ReactNode;
};

const variantStyles: Record<
  Variant,
  { container: ViewStyle; text: TextStyle }
> = {
  primary: {
    container: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    text: {
      color: colors.white,
    },
  },
  secondary: {
    container: {
      backgroundColor: colors.white,
      borderColor: colors.primary,
    },
    text: {
      color: colors.primaryDark,
    },
  },
  danger: {
    container: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    text: {
      color: colors.white,
    },
  },
  ghost: {
    container: {
      backgroundColor: "transparent",
      borderColor: "transparent",
    },
    text: {
      color: colors.mutedText,
    },
  },
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  fullWidth = false,
  disabled = false,
  loading = false,
  style,
  leftIcon,
}) => {
  const theme = variantStyles[variant];
  const spinnerColor =
    typeof theme.text.color === "string" ? theme.text.color : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        theme.container,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? (
        <Spinner size={namedSizeMap.small} color={spinnerColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={styles.iconWrapper}>{leftIcon}</View> : null}
          <Text style={[styles.label, theme.text]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors } from "@/theme/colors";

type Option = {
  value: string;
  label: string;
  description?: string;
};

type OptionCardGroupProps = {
  title?: string;
  helperText?: string;
  options: Option[];
  selectedValue: string;
  onSelect: (value: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  allowClear?: boolean;
};

export const OptionCardGroup: React.FC<OptionCardGroupProps> = ({
  title,
  helperText,
  options,
  selectedValue,
  onSelect,
  containerStyle,
  allowClear = false,
}) => {
  const handlePress = (value: string) => {
    if (allowClear && selectedValue === value) {
      onSelect("");
      return;
    }
    onSelect(value);
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      <View style={styles.grid}>
        {options.map((option) => {
          const isSelected = option.value === selectedValue;
          return (
            <Pressable
              key={option.value}
              onPress={() => handlePress(option.value)}
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
            >
              <Text
                style={[styles.label, isSelected && styles.labelSelected]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              {option.description ? (
                <Text
                  style={[
                    styles.description,
                    isSelected && styles.descriptionSelected,
                  ]}
                  numberOfLines={2}
                >
                  {option.description}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  helper: {
    fontSize: 12,
    color: colors.mutedText,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 1,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
    shadowOpacity: 0.1,
  },
  cardPressed: {
    opacity: 0.92,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  labelSelected: {
    color: colors.primaryDark,
  },
  description: {
    fontSize: 12,
    color: colors.mutedText,
  },
  descriptionSelected: {
    color: colors.primaryDark,
  },
});

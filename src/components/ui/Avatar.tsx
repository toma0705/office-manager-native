import React, { useMemo, useState } from "react";
import type { ImageStyle, StyleProp, ViewStyle } from "react-native";
import { Image, StyleSheet, View, Text } from "react-native";
import { colors } from "@/theme/colors";

type Props = {
  uri?: string | null;
  alt?: string;
  size?: number;
  /** 余白など（画像のときも、頭文字のときも付ける） */
  containerStyle?: StyleProp<ViewStyle>;
};

const getInitial = (name?: string) => {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 1).toUpperCase();
};

export const Avatar: React.FC<Props> = ({
  uri,
  alt,
  size = 64,
  containerStyle,
}) => {
  const [isError, setIsError] = useState(false);
  const initials = useMemo(() => getInitial(alt), [alt]);
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (!uri || isError) {
    return (
      <View style={[styles.placeholder, containerStyle, shape]}>
        <Text style={styles.initial}>{initials}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, containerStyle as StyleProp<ImageStyle>, shape]}
      onError={() => setIsError(true)}
      resizeMode="cover"
    />
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: "#e5e7eb",
    borderWidth: 2,
    borderColor: colors.primary,
  } as ImageStyle,
  placeholder: {
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  initial: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primaryDark,
  },
});

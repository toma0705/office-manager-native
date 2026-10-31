import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform } from "react-native";

type Props = {
  /** iOS の SF Symbols の名前 */
  ios: React.ComponentProps<typeof SymbolView>["name"];
  /** Android の Feather アイコンの名前 */
  android: React.ComponentProps<typeof Feather>["name"];
  color: string;
  size?: number;
};

/** iOS では SF Symbols、Android では Feather のアイコンを出す */
export const PlatformIcon: React.FC<Props> = ({
  ios,
  android,
  color,
  size = 20,
}) =>
  Platform.OS === "ios" ? (
    <SymbolView
      name={ios}
      tintColor={color}
      style={{ width: size, height: size }}
      weight="regular"
    />
  ) : (
    <Feather name={android} size={size} color={color} />
  );

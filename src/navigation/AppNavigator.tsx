import React from "react";
import { Text, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";
import { namedSizeMap } from "@/utils/size";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ResetPasswordRequest: undefined;
  ResetPassword: { token: string } | undefined;
  Home: undefined;
  Users: undefined;
};

const LoadingScreen = () => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <Spinner size={namedSizeMap.large} color="#7bc062" />
  </View>
);

export const AppNavigator: React.FC = () => {
  const { status } = useAuth();

  if (status === "checking") {
    return <LoadingScreen />;
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>アプリの一時的な休止表示です。</Text>
    </View>
  );
};

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { LoginScreen } from "@/screens/LoginScreen";
import { RegisterScreen } from "@/screens/RegisterScreen";
import { ResetPasswordRequestScreen } from "@/screens/ResetPasswordRequestScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { UsersScreen } from "@/screens/UsersScreen";
import { Spinner } from "@/components/ui/Spinner";
import { namedSizeMap } from "@/utils/size";
import { colors } from "@/theme/colors";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ResetPasswordRequest: undefined;
  Home: undefined;
  Users: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const LoadingScreen = () => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <Spinner size={namedSizeMap.large} color={colors.primary} />
  </View>
);

/**
 * 画面の切り替え。ログイン状態で、ログイン前の画面とログイン後の画面を出し分ける。
 * パスワードの再設定は、メールのリンクから Web の画面で行う。
 */
export const AppNavigator: React.FC = () => {
  const { status } = useAuth();

  return (
    <NavigationContainer>
      {status === "checking" ? (
        <LoadingScreen />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {status !== "signedIn" ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen
                name="ResetPasswordRequest"
                component={ResetPasswordRequestScreen}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Users" component={UsersScreen} />
            </>
          )}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

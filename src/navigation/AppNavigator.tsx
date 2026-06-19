import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { LoginScreen } from "@/screens/LoginScreen";
import { RegisterScreen } from "@/screens/RegisterScreen";
import { ResetPasswordRequestScreen } from "@/screens/ResetPasswordRequestScreen";
import { ResetPasswordScreen } from "@/screens/ResetPasswordScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { UsersScreen } from "@/screens/UsersScreen";
import { Spinner } from "@/components/ui/Spinner";
import { namedSizeMap } from "@/utils/size";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import {
  setupNotifications,
  NOTIFICATION_ACTIONS,
} from "@/utils/notifications";
import { startGeofencing, stopGeofencing } from "@/utils/geofencing";
import { handleEnterAction, handleExitAction } from "@/utils/backgroundActions";

const PlaceholderScreen = () => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <Text>準備中</Text>
  </View>
);

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ResetPasswordRequest: undefined;
  ResetPassword: { token: string } | undefined;
  Home: undefined;
  Users: undefined;
  Placeholder: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const LoadingScreen = () => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <Spinner size={namedSizeMap.large} color="#7bc062" />
  </View>
);

export const AppNavigator: React.FC = () => {
  const { status } = useAuth();

  useEffect(() => {
    setupNotifications();

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const actionId = response.actionIdentifier;
        if (actionId === NOTIFICATION_ACTIONS.ENTER) {
          handleEnterAction();
        } else if (actionId === NOTIFICATION_ACTIONS.EXIT) {
          handleExitAction();
        }
      },
    );

    return () => subscription.remove();
  }, []);

  // useEffect(() => {
  //   if (status === "signedIn") {
  //     // TODO: オフィスの座標を動的に取得する
  //     // 現在は仮で岡山大学付近 (34.6850, 133.9190)
  //     startGeofencing(34.685, 133.919).catch(console.error);
  //   } else {
  //     stopGeofencing().catch(console.error);
  //   }
  // }, [status]);

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
              <Stack.Screen
                name="ResetPassword"
                component={ResetPasswordScreen}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Placeholder" component={PlaceholderScreen} />
            </>
          )}
          <Stack.Screen name="Users" component={UsersScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

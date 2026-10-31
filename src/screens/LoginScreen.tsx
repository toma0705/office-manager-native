import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { PageContainer } from "@/components/layout/PageContainer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PlatformIcon } from "@/components/ui/PlatformIcon";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import type { UsersLoginPostRequest } from "@office-manager/api-client";
import { colors } from "@/theme/colors";
import { credentialStorage } from "@/storage/credentialStorage";
import {
  authenticateWithBiometrics,
  canUseBiometrics,
  EXPO_GO_BIOMETRICS_MESSAGE,
} from "@/services/biometrics";

export const LoginScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signIn, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedCredentials, setSavedCredentials] =
    useState<UsersLoginPostRequest | null>(null);
  const [biometricVisible, setBiometricVisible] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState("");

  useEffect(() => {
    let active = true;
    if (status === "signedOut") {
      const loadCredentials = async () => {
        try {
          const saved = await credentialStorage.get();
          if (!active) return;
          if (saved) {
            setSavedCredentials(saved);
            setEmail(saved.email);
            setBiometricError("");
            setBiometricVisible(canUseBiometrics);
          } else {
            setSavedCredentials(null);
            setBiometricVisible(false);
          }
        } catch (error) {
          console.warn("Failed to read saved credentials", error);
          if (!active) return;
          setSavedCredentials(null);
          setBiometricVisible(false);
        }
      };

      void loadCredentials();
    } else {
      setSavedCredentials(null);
      setBiometricVisible(false);
    }

    return () => {
      active = false;
    };
  }, [status]);

  const handleBiometricDismiss = () => {
    if (biometricLoading) return;
    setBiometricVisible(false);
  };

  const handleBiometricOpen = () => {
    if (!savedCredentials) return;
    if (!canUseBiometrics) {
      setBiometricError(EXPO_GO_BIOMETRICS_MESSAGE);
      setBiometricVisible(false);
      return;
    }
    setBiometricError("");
    setBiometricVisible(true);
  };

  /** 保存しているログイン情報を忘れ、手動でログインしてもらう */
  const forgetSavedCredentials = async (message: string) => {
    setBiometricError(message);
    await credentialStorage.remove();
    setSavedCredentials(null);
    setBiometricVisible(false);
  };

  const handleBiometricLogin = async () => {
    if (!savedCredentials || biometricLoading) return;
    if (!canUseBiometrics) {
      setBiometricError(EXPO_GO_BIOMETRICS_MESSAGE);
      setBiometricVisible(false);
      return;
    }
    setBiometricError("");
    setBiometricLoading(true);
    let signedInSuccessfully = false;
    try {
      const result = await authenticateWithBiometrics("顔認証でログイン");
      if (!result.ok) {
        switch (result.reason) {
          case "no-hardware":
            setBiometricError("この端末では顔認証を利用できません。");
            break;
          case "not-enrolled":
            setBiometricError("顔認証が設定されていません。");
            break;
          case "missing-usage-description":
            await forgetSavedCredentials(
              "Face ID を利用するには iOS の設定でこのアプリにFace ID利用許可(NSFaceIDUsageDescription)を付与する必要があります。Expo Go ではご利用いただけません。"
            );
            break;
          case "failed":
            setBiometricError("顔認証に失敗しました。再度お試しください。");
            break;
          case "cancelled":
            break;
        }
        return;
      }

      setLoading(true);
      setErrorMessage("");
      await signIn(savedCredentials);
      signedInSuccessfully = true;
      setBiometricVisible(false);
    } catch (error) {
      console.error("Failed to login via biometrics", error);
      await forgetSavedCredentials(
        "顔認証でのログインに失敗しました。手動でログインしてください。"
      );
    } finally {
      setBiometricLoading(false);
      if (!signedInSuccessfully) setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMessage("");
    try {
      await signIn({ email: email.trim(), password: password.trim() });
    } catch (error) {
      console.error("Failed to login", error);
      setErrorMessage("メールアドレスまたはパスワードが違います");
    } finally {
      setLoading(false);
    }
  };

  const goRegister = () => navigation.navigate("Register");
  const goReset = () => navigation.navigate("ResetPasswordRequest");

  return (
    <>
      <PageContainer contentStyle={styles.pageContent}>
        <View style={styles.form}>
          <Text style={styles.title}>入退室管理{"\n"}PlayGround専用</Text>
          <Input
            label="メールアドレス"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="パスワード"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
          {errorMessage ? (
            <Text style={styles.error}>{errorMessage}</Text>
          ) : null}
          <Button
            title={loading ? "ログイン中..." : "ログイン"}
            onPress={handleLogin}
            loading={loading}
            fullWidth
          />
          <Button
            title="新規登録"
            variant="secondary"
            onPress={goRegister}
            fullWidth
            disabled={loading}
          />
          <LinkButton
            title="パスワードをお忘れの方はこちら"
            onPress={goReset}
            center
          />
          {savedCredentials ? (
            <LinkButton
              title="Face IDでログイン"
              onPress={handleBiometricOpen}
              center
            />
          ) : null}
        </View>
      </PageContainer>

      <BottomSheet
        visible={biometricVisible && Boolean(savedCredentials)}
        onClose={handleBiometricDismiss}
        style={styles.biometricSheet}
      >
        <Pressable
          style={styles.biometricCloseButton}
          onPress={handleBiometricDismiss}
          disabled={biometricLoading}
          accessibilityLabel="顔認証ポップアップを閉じる"
        >
          <PlatformIcon
            ios="xmark.circle.fill"
            android="x-circle"
            size={28}
            color={colors.mutedText}
          />
        </Pressable>
        <View style={styles.biometricIconWrapper}>
          {Platform.OS === "ios" ? (
            <SymbolView
              name="faceid"
              style={styles.biometricSymbol}
              weight="regular"
              scale="large"
              tintColor={colors.primaryDark}
            />
          ) : (
            <Text style={styles.biometricIcon}>🙂</Text>
          )}
        </View>
        <Text style={styles.biometricTitle}>サインイン</Text>
        {savedCredentials ? (
          <Text style={styles.biometricDescription}>
            {`"${savedCredentials.email}" のパスワードを使用してログインしますか？`}
          </Text>
        ) : null}
        {biometricError ? (
          <Text style={styles.biometricError}>{biometricError}</Text>
        ) : null}
        <Pressable
          style={[
            styles.biometricPrimaryButton,
            biometricLoading && styles.biometricPrimaryButtonDisabled,
          ]}
          onPress={handleBiometricLogin}
          disabled={biometricLoading}
        >
          {biometricLoading ? (
            <Spinner size="small" color={colors.white} />
          ) : (
            <Text style={styles.biometricPrimaryLabel}>パスワードを入力</Text>
          )}
        </Pressable>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  pageContent: {
    flexGrow: 1,
  },
  form: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  title: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 48,
    color: colors.primaryDark,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    fontWeight: "600",
  },
  biometricSheet: {
    paddingTop: 32,
  },
  biometricCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  biometricIconWrapper: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  biometricSymbol: {
    width: 36,
    height: 36,
  },
  biometricIcon: {
    fontSize: 32,
  },
  biometricTitle: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  biometricDescription: {
    textAlign: "center",
    color: colors.mutedText,
    lineHeight: 20,
  },
  biometricError: {
    textAlign: "center",
    color: colors.danger,
    fontWeight: "600",
  },
  biometricPrimaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  biometricPrimaryButtonDisabled: {
    opacity: 0.6,
  },
  biometricPrimaryLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});

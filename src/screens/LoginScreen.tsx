import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { PageContainer } from "@/components/layout/PageContainer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { useAuth } from "@/hooks/useAuth";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { colors } from "@/theme/colors";

export const LoginScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signIn, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (status === "signedIn") {
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    }
  }, [navigation, status]);

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
  const goUsers = () => navigation.navigate("Users");

  return (
    <PageContainer contentStyle={styles.pageContent}>
      <View style={styles.form}>
        <Text style={styles.title}>Office Manager</Text>
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
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
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
        <LinkButton title="ユーザーリストを見る" onPress={goUsers} center />
        <LinkButton
          title="パスワードをお忘れの方はこちら"
          onPress={goReset}
          center
        />
      </View>
    </PageContainer>
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
    marginBottom: 12,
    color: colors.primaryDark,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    fontWeight: "600",
  },
});

import React, { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { PageContainer } from "@/components/layout/PageContainer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createUsersApi } from "@/api/client";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { colors } from "@/theme/colors";

export const ResetPasswordScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, "ResetPassword">>();
  const token = route.params?.token;
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (loading) return;
    if (!token) {
      Alert.alert(
        "無効なリンク",
        "トークンが無効です。メールのリンクを再度開いてください。"
      );
      return;
    }
    if (!password.trim()) {
      Alert.alert("入力エラー", "新しいパスワードを入力してください。");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const api = createUsersApi();
      await api.usersResetPasswordTokenPost({
        token,
        usersResetPasswordTokenPostRequest: { password: password.trim() },
      });
      setMessage(
        "パスワードがリセットされました。アプリに戻り、ログイン画面から再度ログインしてください。"
      );
    } catch (error) {
      console.error("failed to reset password", error);
      setMessage("リセットに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <Text style={styles.title}>新しいパスワード設定</Text>
      <Input
        label="新しいパスワード"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title={loading ? "リセット中..." : "パスワードをリセット"}
        onPress={handleSubmit}
        loading={loading}
        fullWidth
      />
      {message ? (
        <Text
          style={[
            styles.message,
            message.includes("リセットされました")
              ? styles.messageSuccess
              : styles.messageError,
          ]}
        >
          {message}
        </Text>
      ) : null}
    </PageContainer>
  );
};

const styles = StyleSheet.create({
  title: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
    color: colors.primaryDark,
  },
  message: {
    marginTop: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  messageSuccess: {
    color: colors.primaryDark,
  },
  messageError: {
    color: colors.danger,
  },
});

import React, { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { PageContainer } from "@/components/layout/PageContainer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createUsersApi } from "@/api/client";
import { colors } from "@/theme/colors";

export const ResetPasswordRequestScreen: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (loading) return;
    if (!email.trim()) {
      Alert.alert("入力エラー", "メールアドレスを入力してください。");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const api = createUsersApi();
      await api.usersResetPasswordRequestPost({
        usersResetPasswordRequestPostRequest: { email: email.trim() },
      });
      setMessage(
        "パスワード再設定用のメールを送信しました。メールをご確認ください。"
      );
    } catch (error) {
      console.error("failed to request reset password", error);
      setMessage("送信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <Text style={styles.title}>パスワード再設定</Text>
      <Input
        label="登録メールアドレス"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button
        title={loading ? "送信中..." : "再設定メールを送信"}
        onPress={handleSubmit}
        loading={loading}
        fullWidth
      />
      {message ? (
        <Text
          style={[
            styles.message,
            message.includes("送信")
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

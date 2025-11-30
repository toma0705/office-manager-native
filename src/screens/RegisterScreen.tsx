import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { Picker } from "@react-native-picker/picker";
import type { Office } from "@office-manager/api-client";
import { PageContainer } from "@/components/layout/PageContainer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { createOfficesApi } from "@/api/client";
import { withApiPath } from "@/constants/config";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { colors } from "@/theme/colors";

export const RegisterScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [icon, setIcon] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const api = createOfficesApi();
        const list = await api.officesGet();
        setOffices(list);
      } catch (error) {
        console.warn("Failed to fetch offices", error);
        setErrorMessage("オフィス情報の取得に失敗しました");
      }
    };
    void fetchOffices();
  }, []);

  const iconPreviewUri = useMemo(() => icon?.uri, [icon]);

  const ensurePermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert(
        "権限が必要です",
        "写真ライブラリへのアクセスを許可してください。"
      );
      return false;
    }
    return true;
  }, []);

  const handlePickIcon = useCallback(async () => {
    const granted = await ensurePermissions();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setIcon(result.assets[0]);
    }
  }, [ensurePermissions]);

  const handleRegister = useCallback(async () => {
    if (loading) return;
    if (
      !name.trim() ||
      !email.trim() ||
      !password.trim() ||
      !icon ||
      !selectedOffice
    ) {
      Alert.alert("入力内容を確認してください", "必須項目が未入力です。");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setErrorDetail("");
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("email", email.trim());
      formData.append("password", password.trim());
      formData.append("officeCode", selectedOffice);
      formData.append("icon", {
        uri: icon.uri,
        name: icon.fileName ?? "avatar.jpg",
        type: icon.mimeType ?? "image/jpeg",
      } as any);

      const response = await fetch(withApiPath("/users"), {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        Alert.alert("登録完了", "ユーザーが登録されました。", [
          {
            text: "OK",
            onPress: () => navigation.replace("Login"),
          },
        ]);
        setName("");
        setEmail("");
        setPassword("");
        setSelectedOffice("");
        setIcon(null);
        return;
      }

      const text = await response.text();
      let errorBody: any;
      try {
        errorBody = text ? JSON.parse(text) : undefined;
      } catch (error) {
        console.warn("Failed to parse error response", error);
      }

      const message = errorBody?.error ?? "ユーザー追加に失敗しました";
      const detail = errorBody?.detail ?? text;
      setErrorMessage(message);
      setErrorDetail(detail ?? "");
    } catch (error) {
      console.error("Failed to register", error);
      setErrorMessage("ユーザー追加時にエラーが発生しました");
      setErrorDetail(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [email, icon, loading, name, navigation, password, selectedOffice]);

  return (
    <PageContainer>
      <Text style={styles.title}>新規ユーザー登録</Text>
      <View style={styles.card}>
        <View style={styles.pickerContainer}>
          <Text style={styles.label}>所属オフィス</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedOffice}
              onValueChange={(value: string) => setSelectedOffice(value)}
              mode="dropdown"
            >
              <Picker.Item label="オフィスを選択してください" value="" />
              {offices.map((office) => (
                <Picker.Item
                  key={office.id}
                  label={office.name}
                  value={office.code}
                />
              ))}
            </Picker>
          </View>
        </View>

        <Input
          label="名前"
          value={name}
          onChangeText={setName}
          autoCapitalize="none"
        />
        <Input
          label="メールアドレス"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label="パスワード"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <View style={styles.iconUploadArea}>
          <Button
            title="アイコン画像を選択"
            variant="secondary"
            onPress={handlePickIcon}
          />
          {iconPreviewUri ? (
            <Avatar
              uri={iconPreviewUri}
              alt={name}
              size={80}
              containerStyle={styles.iconPreview}
            />
          ) : (
            <Text style={styles.iconHint}>選択済みの画像はありません</Text>
          )}
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            {errorDetail ? (
              <Text style={styles.errorDetail}>{errorDetail}</Text>
            ) : null}
          </View>
        ) : null}

        <Button
          title="追加"
          onPress={handleRegister}
          loading={loading}
          fullWidth
        />
        <Button
          title="ログイン画面に戻る"
          variant="secondary"
          onPress={() => navigation.navigate("Login")}
          fullWidth
        />
      </View>
    </PageContainer>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
    color: colors.primaryDark,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  pickerContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  iconUploadArea: {
    alignItems: "center",
    gap: 12,
  },
  iconPreview: {
    marginTop: 6,
  },
  iconHint: {
    color: colors.mutedText,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: "#fdecea",
    padding: 12,
    borderRadius: 12,
  },
  errorMessage: {
    color: colors.danger,
    fontWeight: "700",
    textAlign: "center",
  },
  errorDetail: {
    marginTop: 8,
    color: colors.danger,
    fontSize: 12,
  },
});

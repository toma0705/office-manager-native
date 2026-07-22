import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  Linking,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { EnteredUser } from "@office-manager/api-client/dist/esm/index";
import { StatusTitle } from "@/components/home/StatusTitle";
import { EnteredUsersList } from "@/components/home/EnteredUsersList";
import { UserSidebar } from "@/components/home/UserSidebar";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { createNotificationsApi, createUsersApi } from "@/api/client";
import { withApiPath } from "@/constants/config";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { colors } from "@/theme/colors";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { getDistanceToOffice } from "@/utils/location";

export const HomeScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, token, signOut, setUserState } = useAuth();
  const [enteredUsers, setEnteredUsers] = useState<EnteredUser[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [locationMessage, setLocationMessage] =
    useState("位置情報を確認しています...");
  const [debugDistance, setDebugDistance] = useState<string | null>(null);

  const entered = Boolean(user?.entered);

  // データの取得 (画面を開いた時やリフレッシュ時に最新状態を読み込むのみ)
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const api = createUsersApi(token);
      const response = await api.usersMeGet();
      setEnteredUsers(response.enteredUsers ?? []);
      setUserState(response.user); // 複雑な分岐を削除してシンプルにセット
    } catch (error) {
      console.error("Failed to load home data", error);
      Alert.alert(
        "エラー",
        "ユーザー情報の取得に失敗しました。ログインし直してください。",
        [{ text: "OK", onPress: () => void signOut() }],
      );
    }
  }, [setUserState, signOut, token]);

  // 通知の送信 (メモ追加用として残しています)
  const notifyStatus = useCallback(
    async (status: "入室" | "退室" | "メモを追加", note?: string) => {
      if (!token || !user) return;
      try {
        const api = createNotificationsApi(token);
        await api.notifyPost({
          notifyPostRequest: {
            user: user.name,
            status,
            officeCode: user.office?.code ?? null,
            note,
          },
        });
      } catch (error) {
        console.warn("Failed to send notification", error);
      }
    },
    [token, user],
  );

  // 画面に表示する位置情報ステータスの確認
  const evaluateAutoAttendance = useCallback(async () => {
    if (!user || !token) return;

    try {
      // 現在の「常に許可（Background）」のステータスを確認
      const { status: bgStatus } =
        await Location.getBackgroundPermissionsAsync();

      if (bgStatus !== "granted") {
        setLocationMessage(
          "自動入退室には位置情報の利用を「常に許可」にする必要があります。設定 > プライバシーとセキュリティ > 位置情報サービス > 入退室管理 から許可してください。[設定を開く]",
        );
        return;
      }

      // 「常に許可」されているなら、案内テキストを出す
      setLocationMessage(
        entered
          ? "バックグラウンドでの自動入退室が有効です。オフィスから離れると自動退室します。"
          : "バックグラウンドでの自動入退室が有効です。オフィスに近づくと自動入室します。",
      );
    } catch (error) {
      console.error("Failed to evaluate auto attendance", error);
      setLocationMessage("位置情報の状態確認に失敗しました。");
    }
  }, [entered, token, user]);

  useFocusEffect(
    useCallback(() => {
      void fetchData(); // サーバーから最新データを取得
      void evaluateAutoAttendance(); // 位置情報の権限をチェック
    }, [fetchData, evaluateAutoAttendance]),
  );

  // メモの保存・ログアウト・アカウント削除
  const handleSaveNote = useCallback(
    async (userId: number, note: string) => {
      if (!token) return;
      try {
        const api = createUsersApi(token);
        await api.usersIdPatch({ id: userId, usersIdPatchRequest: { note } });
        if (user && user.id === userId) {
          setUserState({ ...user, note });
          const trimmed = note.trim();
          if (trimmed) {
            await notifyStatus("メモを追加", trimmed);
          }
        }
        await fetchData();
      } catch (error) {
        console.error("Failed to save note", error);
        Alert.alert("保存に失敗しました", "メモの保存に失敗しました。");
      }
    },
    [fetchData, notifyStatus, setUserState, token, user],
  );

  const handleDeleteAccount = useCallback(async () => {
    if (!user) return;
    Alert.alert(
      "確認",
      "本当にアカウントを削除しますか？この操作は元に戻せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(withApiPath(`/users/${user.id}`), {
                method: "DELETE",
              });
              if (!response.ok) throw new Error("Failed to delete account");
              await signOut({ forgetCredentials: true });
            } catch (error) {
              console.error("Failed to delete account", error);
              Alert.alert("削除失敗", "アカウントの削除に失敗しました。");
            }
          },
        },
      ],
    );
  }, [signOut, user]);

  const handleCheckDistance = async () => {
    if (!user?.office) return;

    // 1. 一度状態をクリアして「計測中」であることを明示する（UIの更新を強制する）
    setDebugDistance("計測中...");

    try {
      const distance = await getDistanceToOffice(
        user.office.latitude,
        user.office.longitude,
      );
      // 2. 結果をセット
      setDebugDistance(`現在のオフィスまでの距離: ${Math.round(distance)}m`);
    } catch (error) {
      setDebugDistance("計測失敗");
      console.error(error);
    }
  };

  const enteredCount = React.useMemo(() => enteredUsers.length, [enteredUsers]);

  const renderSymbol = (
    iosName: React.ComponentProps<typeof SymbolView>["name"],
    fallbackName: React.ComponentProps<typeof Feather>["name"],
    color: string,
  ) => {
    if (Platform.OS === "ios") {
      return (
        <SymbolView
          name={iosName}
          tintColor={color}
          style={styles.actionSymbol}
          weight="regular"
        />
      );
    }
    return <Feather name={fallbackName} size={20} color={color} />;
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  const renderLocationStatus = () => {
    const linkTrigger = "[設定を開く]";

    if (locationMessage.includes(linkTrigger)) {
      const parts = locationMessage.split(linkTrigger);
      return (
        <Text style={styles.locationStatus}>
          {parts[0]}
          <Text
            style={styles.locationLink}
            onPress={() => {
              Linking.openSettings().catch(() => {
                console.warn("設定画面を開けませんでした");
              });
            }}
          >
            設定を開く
          </Text>
          {parts[1]}
        </Text>
      );
    }

    return <Text style={styles.locationStatus}>{locationMessage}</Text>;
  };

  const listHeader = (
    <View style={styles.headerContainer}>
      <View style={styles.topControls}>
        <Button
          title="すべてのユーザーを見る"
          variant="secondary"
          onPress={() => navigation.navigate("Users")}
          leftIcon={renderSymbol("person.2.fill", "users", colors.primaryDark)}
        />
        <TouchableOpacity onPress={() => setSidebarOpen(true)}>
          <Avatar uri={user.iconFileName} alt={user.name} size={72} />
        </TouchableOpacity>
      </View>

      <StatusTitle entered={entered} />

      {renderLocationStatus()}

      <View>
        <Button
          title="距離をデバッグ計測"
          variant="secondary"
          onPress={handleCheckDistance}
        />
        {debugDistance && (
          <Text style={{ textAlign: "center", marginTop: 10 }}>
            {debugDistance}
          </Text>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{user.office.name}</Text>
        <Text style={[styles.sectionTitle, styles.sectionSubtitle]}>
          入室中ユーザー ({enteredCount}人)
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <EnteredUsersList
        me={user}
        users={enteredUsers}
        onSaveNote={handleSaveNote}
        header={listHeader}
        contentContainerStyle={styles.listContent}
      />

      <UserSidebar
        visible={isSidebarOpen}
        user={user}
        onClose={() => setSidebarOpen(false)}
        onLogout={useCallback(() => void signOut(), [signOut])}
        onDelete={handleDeleteAccount}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 24,
  },
  headerContainer: { gap: 24 },
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
  },
  actionSymbol: { width: 20, height: 20 },
  locationStatus: {
    marginTop: -8,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  locationLink: {
    color: "#007AFF",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  sectionHeader: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  sectionSubtitle: { marginTop: 4 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
});

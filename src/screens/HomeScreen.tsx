import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { EnteredUser } from "@office-manager/api-client";
import { StatusTitle } from "@/components/home/StatusTitle";
import { EnteredUsersList } from "@/components/home/EnteredUsersList";
import { UserSidebar } from "@/components/home/UserSidebar";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { createUsersApi } from "@/api/client";
import { withApiPath } from "@/constants/config";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import {
  ensureBackgroundAttendanceMonitoring,
  onBackgroundAttendanceChanged,
} from "@/services/backgroundBeacon";
import { colors } from "@/theme/colors";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import { getOfficeBeacon } from "@/constants/beacon";

export const HomeScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, token, signOut, setUserState } = useAuth();
  const [enteredUsers, setEnteredUsers] = useState<EnteredUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [locationMessage, setLocationMessage] =
    useState("ビーコンを確認しています...");
  const backgroundSetupAttemptedRef = useRef(false);

  const entered = Boolean(user?.entered);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const api = createUsersApi(token);
      const response = await api.usersMeGet();
      setEnteredUsers(response.enteredUsers ?? []);
      setUserState(response.user);
    } catch (error) {
      console.error("Failed to load home data", error);
      Alert.alert(
        "エラー",
        "ユーザー情報の取得に失敗しました。ログインし直してください。",
        [{ text: "OK", onPress: () => void signOut() }],
      );
    } finally {
      setRefreshing(false);
    }
  }, [setUserState, signOut, token]);

  useEffect(
    () =>
      onBackgroundAttendanceChanged(() => {
        void fetchData();
      }),
    [fetchData],
  );

  useEffect(() => {
    if (!user || !token || backgroundSetupAttemptedRef.current) return;
    backgroundSetupAttemptedRef.current = true;

    const setup = async () => {
      const result = await ensureBackgroundAttendanceMonitoring(token, user);
      if (result.started) {
        setLocationMessage(
          "オフィスのビーコンを監視中です。圏内に入ると自動で入退室します。",
        );
        return;
      }

      switch (result.reason) {
        case "background-denied":
          setLocationMessage(
            "位置情報が「常に許可」でないため、ビーコンの自動検知を開始できません。設定アプリで「常に」に変更してください。",
          );
          break;
        case "foreground-denied":
          setLocationMessage(
            "位置情報が未許可のため、ビーコンの自動検知を開始できません。",
          );
          break;
        case "beacon-unavailable":
          setLocationMessage(
            "この実行環境ではビーコン検知を利用できません（Development Build が必要です）。",
          );
          break;
        case "unsupported-office":
          setLocationMessage(
            "このオフィスはまだバックグラウンド監視の対象外です。",
          );
          break;
      }
    };

    void setup();
  }, [token, user]);

  useEffect(() => {
    if (!user?.office) return;
    if (!getOfficeBeacon(user.office))
      setLocationMessage(`${user.office.name} はまだ自動入退室の対象外です。`);
  }, [user?.office]);

  const handleLogout = useCallback(async () => {
    await signOut();
  }, [signOut]);

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

  const enteredCount = useMemo(() => enteredUsers.length, [enteredUsers]);
  const refreshDisabled = refreshing;
  type SymbolName = React.ComponentProps<typeof SymbolView>["name"];

  const renderSymbol = (
    iosName: SymbolName,
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
      <Text style={styles.locationStatus}>{locationMessage}</Text>

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
        users={enteredUsers}
        header={listHeader}
        contentContainerStyle={styles.listContent}
      />

      <UserSidebar
        visible={isSidebarOpen}
        user={user}
        onClose={() => setSidebarOpen(false)}
        onRefresh={() => void fetchData()}
        refreshDisabled={refreshDisabled}
        refreshing={refreshing}
        onLogout={handleLogout}
        onDelete={handleDeleteAccount}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 24,
  },
  headerContainer: {
    gap: 24,
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
  },
  actionSymbol: {
    width: 20,
    height: 20,
  },
  locationStatus: {
    marginTop: -8,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  locationMeta: {
    marginTop: -16,
    textAlign: "center",
    fontSize: 12,
    color: colors.mutedText,
  },
  backgroundMonitoringStatus: {
    marginTop: -18,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedText,
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
  sectionSubtitle: {
    marginTop: 4,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

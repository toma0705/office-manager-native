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
import * as Location from "expo-location";
import { StatusTitle } from "@/components/home/StatusTitle";
import { EnterExitButtons } from "@/components/home/EnterExitButtons";
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
import {
  calculateDistanceMeters,
  getOfficeLocation,
  shouldAutoEnter,
  shouldAutoExit,
} from "@/utils/location";

export const HomeScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, token, signOut, setUserState } = useAuth();
  const [enteredUsers, setEnteredUsers] = useState<EnteredUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"enter" | "exit" | null>(
    null
  );
  const [locationMessage, setLocationMessage] = useState(
    "位置情報を確認しています..."
  );
  const [lastDistanceMeters, setLastDistanceMeters] = useState<number | null>(
    null
  );
  const autoActionInFlightRef = useRef(false);

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
        [{ text: "OK", onPress: () => void signOut() }]
      );
    } finally {
      setRefreshing(false);
    }
  }, [setUserState, signOut, token]);

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
    [token, user]
  );

  const performAction = useCallback(
    async (path: string) => {
      if (!token || !user) return false;
      const response = await fetch(withApiPath(path), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "API request failed");
      }
      return true;
    },
    [token, user]
  );

  const runAttendanceAction = useCallback(
    async (action: "enter" | "exit", mode: "manual" | "auto") => {
      if (!user || pendingAction) return false;

      setPendingAction(action);
      if (mode === "auto") {
        autoActionInFlightRef.current = true;
      }

      try {
        await performAction(`/users/${user.id}/${action}`);
        await notifyStatus(action === "enter" ? "入室" : "退室");
        await fetchData();
        return true;
      } catch (error) {
        console.error(`Failed to ${action}`, error);
        if (mode === "manual") {
          Alert.alert(
            action === "enter" ? "入室に失敗しました" : "退室に失敗しました",
            "再度お試しください。"
          );
        }
        return false;
      } finally {
        setPendingAction(null);
        if (mode === "auto") {
          autoActionInFlightRef.current = false;
        }
      }
    },
    [fetchData, notifyStatus, pendingAction, performAction, user]
  );

  const evaluateAutoAttendance = useCallback(async () => {
    if (!user || !token || pendingAction || autoActionInFlightRef.current) {
      return;
    }

    const officeLocation = getOfficeLocation(user.office);
    if (!officeLocation) {
      setLastDistanceMeters(null);
      setLocationMessage(
        `${user.office.name} はまだ自動入退室の対象外です。`
      );
      return;
    }

    try {
      const permission = await Location.getForegroundPermissionsAsync();
      let status = permission.status;

      if (status !== "granted" && permission.canAskAgain) {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }

      if (status !== "granted") {
        setLastDistanceMeters(null);
        setLocationMessage(
          "位置情報が未許可のため、自動入退室は停止しています。"
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const distanceMeters = calculateDistanceMeters(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        officeLocation
      );

      setLastDistanceMeters(distanceMeters);

      if (!entered && shouldAutoEnter(distanceMeters, officeLocation)) {
        setLocationMessage("オフィス到着を検知しました。自動で入室します。");
        const succeeded = await runAttendanceAction("enter", "auto");
        setLocationMessage(
          succeeded
            ? `オフィスから約${Math.round(
                distanceMeters
              )}mです。自動で入室しました。`
            : `オフィスから約${Math.round(
                distanceMeters
              )}mですが、自動入室に失敗しました。`
        );
        return;
      }

      if (entered && shouldAutoExit(distanceMeters, officeLocation)) {
        setLocationMessage("オフィス離脱を検知しました。自動で退室します。");
        const succeeded = await runAttendanceAction("exit", "auto");
        setLocationMessage(
          succeeded
            ? `オフィスから約${Math.round(
                distanceMeters
              )}m離れたため、自動で退室しました。`
            : `オフィスから約${Math.round(
                distanceMeters
              )}mですが、自動退室に失敗しました。`
        );
        return;
      }

      setLocationMessage(
        entered
          ? `オフィスから約${Math.round(
              distanceMeters
            )}mです。十分に離れると自動退室します。`
          : `オフィスから約${Math.round(
              distanceMeters
            )}mです。圏内に入ると自動入室します。`
      );
    } catch (error) {
      console.error("Failed to evaluate auto attendance", error);
      setLastDistanceMeters(null);
      setLocationMessage("位置情報の取得に失敗しました。");
    }
  }, [entered, pendingAction, runAttendanceAction, token, user]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData])
  );

  useFocusEffect(
    useCallback(() => {
      void evaluateAutoAttendance();

      const intervalId = setInterval(() => {
        void evaluateAutoAttendance();
      }, 5_000);

      return () => {
        clearInterval(intervalId);
      };
    }, [evaluateAutoAttendance])
  );

  useEffect(() => {
    if (!user?.office) return;
    if (!getOfficeLocation(user.office)) {
      setLastDistanceMeters(null);
      setLocationMessage(`${user.office.name} はまだ自動入退室の対象外です。`);
    }
  }, [user?.office]);

  const handleEnter = useCallback(async () => {
    await runAttendanceAction("enter", "manual");
  }, [runAttendanceAction]);

  const handleExit = useCallback(async () => {
    await runAttendanceAction("exit", "manual");
  }, [runAttendanceAction]);

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
    [fetchData, notifyStatus, setUserState, token, user]
  );

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
      ]
    );
  }, [signOut, user]);

  const enteredCount = useMemo(() => enteredUsers.length, [enteredUsers]);
  const refreshDisabled = refreshing || pendingAction !== null;
  type SymbolName = React.ComponentProps<typeof SymbolView>["name"];

  const renderSymbol = (
    iosName: SymbolName,
    fallbackName: React.ComponentProps<typeof Feather>["name"],
    color: string
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
      {lastDistanceMeters !== null ? (
        <Text style={styles.locationMeta}>
          判定距離: 約{Math.round(lastDistanceMeters)}m
        </Text>
      ) : null}
      <EnterExitButtons
        entered={entered}
        onEnter={handleEnter}
        onExit={handleExit}
        disabled={pendingAction !== null}
      />

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

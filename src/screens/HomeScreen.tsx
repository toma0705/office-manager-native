import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { EnteredUser } from "@office-manager/api-client";
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

export const HomeScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, token, signOut, setUserState } = useAuth();
  const [enteredUsers, setEnteredUsers] = useState<EnteredUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"enter" | "exit" | null>(
    null
  );

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
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [setUserState, signOut, token]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData])
  );

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

  const handleEnter = useCallback(async () => {
    if (!user || pendingAction) return;
    setPendingAction("enter");
    try {
      await performAction(`/users/${user.id}/enter`);
      await notifyStatus("入室");
      await fetchData();
    } catch (error) {
      console.error("Failed to enter", error);
      Alert.alert("入室に失敗しました", "再度お試しください。");
    } finally {
      setPendingAction(null);
    }
  }, [fetchData, notifyStatus, pendingAction, performAction, user]);

  const handleExit = useCallback(async () => {
    if (!user || pendingAction) return;
    setPendingAction("exit");
    try {
      await performAction(`/users/${user.id}/exit`);
      await notifyStatus("退室");
      await fetchData();
    } catch (error) {
      console.error("Failed to exit", error);
      Alert.alert("退室に失敗しました", "再度お試しください。");
    } finally {
      setPendingAction(null);
    }
  }, [fetchData, notifyStatus, pendingAction, performAction, user]);

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
              await signOut();
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

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => setSidebarOpen(true)}
        >
          <Avatar uri={user.iconFileName} alt={user.name} size={72} />
        </TouchableOpacity>

        <View style={styles.officeBadge}>
          <Text style={styles.officeBadgeText}>{user.office.name}で表示中</Text>
        </View>

        <StatusTitle entered={entered} />
        <EnterExitButtons
          entered={entered}
          onEnter={handleEnter}
          onExit={handleExit}
          disabled={pendingAction !== null}
        />

        <Button
          title={refreshing ? "読込中..." : "最新情報を更新"}
          variant="secondary"
          onPress={() => void fetchData()}
          disabled={refreshing || pendingAction !== null}
          loading={refreshing}
          fullWidth
        />

        <Button
          title="すべてのユーザーを見る"
          variant="secondary"
          onPress={() => navigation.navigate("Users")}
          fullWidth
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            入室中のユーザー ({enteredCount})
          </Text>
        </View>

        <EnteredUsersList
          me={user}
          users={enteredUsers}
          onSaveNote={handleSaveNote}
        />
      </ScrollView>

      <UserSidebar
        visible={isSidebarOpen}
        user={user}
        onClose={() => setSidebarOpen(false)}
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
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 24,
  },
  avatarButton: {
    alignSelf: "flex-end",
  },
  officeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e8f5e9",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderColor: "#c8e6c9",
    borderWidth: 1,
  },
  officeBadgeText: {
    color: colors.primaryDark,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

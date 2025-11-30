import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Office, UserListItem } from "@office-manager/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { OptionCardGroup } from "@/components/ui/OptionCardGroup";
import { createOfficesApi, createUsersApi } from "@/api/client";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { sortOfficesByPriority } from "@/utils/offices";

export const UsersScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>("ALL");

  const load = useCallback(async () => {
    try {
      const [usersApi, officesApi] = [createUsersApi(), createOfficesApi()];
      const [userList, officeList] = await Promise.all([
        usersApi.usersGet(),
        officesApi.officesGet(),
      ]);
      setUsers(userList);
      setOffices(officeList);
    } catch (error) {
      console.error("Failed to load users screen data", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filteredUsers = useMemo(() => {
    if (selectedOffice === "ALL") return users;
    return users.filter((user) => user.office?.code === selectedOffice);
  }, [selectedOffice, users]);

  const officeFilterOptions = useMemo(() => {
    const sortedOffices = sortOfficesByPriority(offices);

    return [
      { value: "ALL", label: "全ユーザー", span: "full" as const },
      ...sortedOffices.map((office) => ({
        value: office.code,
        label: office.name ?? office.code,
      })),
    ];
  }, [offices]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Button
          title="← ホームに戻る"
          variant="secondary"
          onPress={() => navigation.goBack()}
          fullWidth
        />
      </View>
      <Text style={styles.title}>ユーザーリスト</Text>

      <View style={styles.filterCard}>
        <OptionCardGroup
          title="オフィスで絞り込み"
          helperText="表示したいオフィスをタップしてください"
          options={officeFilterOptions}
          selectedValue={selectedOffice}
          onSelect={setSelectedOffice}
        />
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>条件に一致するユーザーがいません</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <Avatar uri={item.iconFileName} alt={item.name} size={48} />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.name}</Text>
              <Text style={styles.userOffice}>
                {item.office?.name ?? "未設定"}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
    color: colors.text,
  },
  filterCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  userOffice: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 4,
  },
  emptyText: {
    textAlign: "center",
    color: colors.mutedText,
    fontSize: 16,
    marginTop: 48,
  },
});

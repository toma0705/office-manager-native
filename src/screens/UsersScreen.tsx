import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Office, UserListItem } from "@office-manager/api-client";
import { Picker } from "@react-native-picker/picker";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { createOfficesApi, createUsersApi } from "@/api/client";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/AppNavigator";

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
        <Text style={styles.filterLabel}>オフィスで絞り込み</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedOffice}
            onValueChange={(value: string) => setSelectedOffice(value)}
          >
            <Picker.Item label="すべてのオフィス" value="ALL" />
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
  filterLabel: {
    fontWeight: "600",
    marginBottom: 8,
    color: colors.text,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
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

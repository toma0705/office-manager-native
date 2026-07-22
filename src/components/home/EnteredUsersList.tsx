import React, { useMemo } from "react";
import type { EnteredUser } from "@office-manager/api-client/dist/esm/index";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { colors } from "@/theme/colors";
import { formatDateTime } from "@/utils/date";

type Props = {
  users: EnteredUser[];
  header?: React.ReactElement | null;
  footer?: React.ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

type ItemProps = {
  user: EnteredUser;
};

const EnteredUserItem: React.FC<ItemProps> = ({ user }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar uri={user.iconFileName} alt={user.name} size={48} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.enteredAt}>
            {user.enteredAt ? formatDateTime(user.enteredAt) : "-"}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const EnteredUsersList: React.FC<Props> = ({
  users,
  header,
  footer,
  contentContainerStyle,
}) => {
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const enteredA = a.enteredAt ? new Date(a.enteredAt).getTime() : 0;
      const enteredB = b.enteredAt ? new Date(b.enteredAt).getTime() : 0;
      return enteredA - enteredB;
    });
  }, [users]);

  return (
    <FlatList
      data={sortedUsers}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <EnteredUserItem user={item} />}
      ListHeaderComponent={header ?? undefined}
      ListFooterComponent={footer ?? undefined}
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      ListEmptyComponent={
        <Text style={styles.emptyText}>現在入室中のユーザーはいません</Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    gap: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  enteredAt: {
    fontSize: 13,
    color: colors.mutedText,
  },
  emptyText: {
    textAlign: "center",
    color: colors.mutedText,
    fontSize: 16,
    paddingVertical: 40,
  },
});

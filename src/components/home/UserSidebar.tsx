import React from "react";
import type { UserSafe } from "@office-manager/api-client";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { PlatformIcon } from "@/components/ui/PlatformIcon";
import { colors } from "@/theme/colors";

type Props = {
  visible: boolean;
  user: UserSafe | null;
  onClose: () => void;
  onLogout: () => void;
  onDelete: () => void;
};

/** ホーム画面で自分のアイコンを押すと出るメニュー（ログアウト・アカウント削除） */
export const UserSidebar: React.FC<Props> = ({
  visible,
  user,
  onClose,
  onLogout,
  onDelete,
}) => {
  if (!user) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Avatar uri={user.iconFileName} alt={user.name} size={72} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.office}>{user.office.name}</Text>
        </View>
      </View>
      <Button
        title="ログアウト"
        variant="secondary"
        onPress={onLogout}
        leftIcon={
          <PlatformIcon
            ios="rectangle.portrait.and.arrow.right"
            android="log-out"
            color={colors.primaryDark}
          />
        }
        fullWidth
      />
      <Button
        title="アカウント削除"
        variant="danger"
        onPress={onDelete}
        leftIcon={
          <PlatformIcon
            ios="trash.fill"
            android="trash-2"
            color={colors.white}
          />
        }
        fullWidth
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  office: {
    fontSize: 14,
    color: colors.mutedText,
  },
});

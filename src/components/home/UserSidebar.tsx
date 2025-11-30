import React from "react";
import type { UserSafe } from "@office-manager/api-client";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { colors } from "@/theme/colors";

type Props = {
  visible: boolean;
  user: UserSafe | null;
  onClose: () => void;
  onLogout: () => void;
  onDelete: () => void;
};

export const UserSidebar: React.FC<Props> = ({
  visible,
  user,
  onClose,
  onLogout,
  onDelete,
}) => {
  if (!user) return null;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.panel}>
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
                fullWidth
              />
              <Button
                title="アカウント削除"
                variant="danger"
                onPress={onDelete}
                fullWidth
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  panel: {
    backgroundColor: colors.white,
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 5,
  },
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

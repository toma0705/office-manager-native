import React from "react";
import {
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "@/theme/colors";

type Props = {
  visible: boolean;
  /** 外側を押したとき・Android の戻るボタンで呼ばれる */
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** 画面の下から出てくるパネル。外側を押すと閉じる */
export const BottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  children,
  style,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.backdrop}>
        {/* パネルの中を押しても閉じないようにする */}
        <TouchableWithoutFeedback>
          <View style={[styles.panel, style]}>{children}</View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  panel: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 5,
  },
});

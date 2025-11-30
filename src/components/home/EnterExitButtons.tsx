import React from "react";
import { View, StyleSheet } from "react-native";
import { Button } from "@/components/ui/Button";

type Props = {
  entered: boolean;
  onEnter: () => void;
  onExit: () => void;
  disabled?: boolean;
};

export const EnterExitButtons: React.FC<Props> = ({
  entered,
  onEnter,
  onExit,
  disabled,
}) => {
  return (
    <View style={styles.container}>
      {entered ? (
        <Button
          title="退室"
          variant="danger"
          onPress={onExit}
          disabled={disabled}
          fullWidth
        />
      ) : (
        <Button title="入室" onPress={onEnter} disabled={disabled} fullWidth />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
});

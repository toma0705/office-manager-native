import React, { useEffect, useMemo, useState } from "react";
import type { EnteredUser, UserSafe } from "@office-manager/api-client";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { colors } from "@/theme/colors";
import { formatDateTime } from "@/utils/date";

type Props = {
  me: UserSafe | null;
  users: EnteredUser[];
  onSaveNote: (userId: number, note: string) => Promise<void> | void;
  header?: React.ReactElement | null;
  footer?: React.ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

type NoteMap = Record<number, string>;

const normalizeNoteValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

type ItemProps = {
  user: EnteredUser;
  isMe: boolean;
  noteValue: string;
  editing: boolean;
  onChangeNote: (value: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
};

const EnteredUserItem: React.FC<ItemProps> = ({
  user,
  isMe,
  noteValue,
  editing,
  onChangeNote,
  onEdit,
  onCancel,
  onSave,
}) => {
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
      <View style={styles.noteArea}>
        {editing ? (
          <>
            <TextInput
              value={noteValue}
              onChangeText={onChangeNote}
              multiline
              numberOfLines={3}
              style={styles.noteInput}
              placeholder="メモを残す"
            />
            <View style={styles.noteButtonRow}>
              <Button title="保存" onPress={onSave} fullWidth />
              <Button
                title="キャンセル"
                variant="ghost"
                onPress={onCancel}
                fullWidth
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.noteText}>
              {noteValue?.trim() ? noteValue : "メモはありません"}
            </Text>
            {isMe ? (
              <Button
                title="編集"
                variant="secondary"
                onPress={onEdit}
                fullWidth
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
};

export const EnteredUsersList: React.FC<Props> = ({
  me,
  users,
  onSaveNote,
  header,
  footer,
  contentContainerStyle,
}) => {
  const [notes, setNotes] = useState<NoteMap>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    const initialNotes: NoteMap = {};
    users.forEach((user) => {
      initialNotes[user.id] = normalizeNoteValue(user.note);
    });
    setNotes(initialNotes);
    setEditingId(null);
  }, [users]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const enteredA = a.enteredAt ? new Date(a.enteredAt).getTime() : 0;
      const enteredB = b.enteredAt ? new Date(b.enteredAt).getTime() : 0;
      return enteredA - enteredB;
    });
  }, [users]);

  const handleEdit = (id: number) => {
    if (me?.id !== id) return;
    setEditingId(id);
  };

  const handleCancel = () => setEditingId(null);

  const handleSave = async (id: number) => {
    const note = normalizeNoteValue(notes[id]);
    await onSaveNote(id, note);
    setEditingId(null);
  };

  return (
    <FlatList
      data={sortedUsers}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <EnteredUserItem
          user={item}
          isMe={me?.id === item.id}
          noteValue={notes[item.id] ?? ""}
          editing={editingId === item.id}
          onChangeNote={(value) =>
            setNotes((previous) => ({ ...previous, [item.id]: value }))
          }
          onEdit={() => handleEdit(item.id)}
          onCancel={handleCancel}
          onSave={() => handleSave(item.id)}
        />
      )}
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
  noteArea: {
    gap: 12,
  },
  noteText: {
    fontSize: 15,
    color: colors.text,
    minHeight: 20,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 16,
  },
  noteButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  emptyText: {
    textAlign: "center",
    color: colors.mutedText,
    fontSize: 16,
    paddingVertical: 40,
  },
});

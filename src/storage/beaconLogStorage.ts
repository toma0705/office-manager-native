import AsyncStorage from "@react-native-async-storage/async-storage";

const BEACON_LOG_KEY = "office-manager/beacon-log";
const MAX_ENTRIES = 30;

type Entry = { at: number; message: string };

let writing: Promise<void> = Promise.resolve();

/** ビーコン検知の経過を端末に残す（バックグラウンドで何が起きたかを後から確認するため） */
export const beaconLogStorage = {
  append: (message: string) => {
    writing = writing.then(async () => {
      try {
        const raw = await AsyncStorage.getItem(BEACON_LOG_KEY);
        const entries: Entry[] = raw ? JSON.parse(raw) : [];
        entries.push({ at: Date.now(), message });
        await AsyncStorage.setItem(
          BEACON_LOG_KEY,
          JSON.stringify(entries.slice(-MAX_ENTRIES))
        );
      } catch (error) {
        console.warn("Failed to append beacon log", error);
      }
    });
    return writing;
  },
  get: async (): Promise<Entry[]> => {
    try {
      const raw = await AsyncStorage.getItem(BEACON_LOG_KEY);
      return raw ? (JSON.parse(raw) as Entry[]) : [];
    } catch {
      return [];
    }
  },
};

export const formatBeaconLog = (entries: Entry[]) =>
  entries
    .slice(-10)
    .reverse()
    .map(e => {
      const d = new Date(e.at);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${e.message}`;
    })
    .join("\n") || "ログはまだありません";

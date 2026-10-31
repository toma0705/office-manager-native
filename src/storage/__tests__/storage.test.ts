import type { UserSafe } from "@office-manager/api-client";
import {
  backgroundAttendanceStorage,
  createBackgroundAttendanceSnapshot,
} from "../backgroundAttendanceStorage";
import { credentialStorage } from "../credentialStorage";
import { tokenStorage } from "../tokenStorage";

const okayamaUser = {
  id: 7,
  name: "テスト",
  email: "t@4nonome.com",
  iconFileName: "",
  officeId: 1,
  office: { id: 1, code: "OKAYAMA", name: "岡山オフィス" },
  entered: true,
} as UserSafe;

describe("backgroundAttendanceStorage", () => {
  beforeEach(() => backgroundAttendanceStorage.remove());

  it("ビーコンのあるオフィスのユーザーなら、覚える情報を作る", () => {
    expect(createBackgroundAttendanceSnapshot("token", okayamaUser)).toEqual({
      token: "token",
      userId: 7,
      entered: true,
      beacon: expect.objectContaining({ major: 1, minor: 1 }),
    });
  });

  it("ビーコンのないオフィスや、トークンがなければ作らない", () => {
    const tokyo = {
      ...okayamaUser,
      office: { id: 2, code: "TOKYO", name: "東京" },
    };
    expect(createBackgroundAttendanceSnapshot("token", tokyo)).toBeNull();
    expect(createBackgroundAttendanceSnapshot("", okayamaUser)).toBeNull();
  });

  it("保存・一部の更新・削除ができる", async () => {
    const snapshot = createBackgroundAttendanceSnapshot("token", okayamaUser)!;
    await backgroundAttendanceStorage.set(snapshot);
    await backgroundAttendanceStorage.patch({ entered: false });
    await expect(backgroundAttendanceStorage.get()).resolves.toEqual({
      ...snapshot,
      entered: false,
    });

    await backgroundAttendanceStorage.remove();
    await expect(backgroundAttendanceStorage.get()).resolves.toBeNull();
  });

  it("保存がなければ一部の更新はしない", async () => {
    await backgroundAttendanceStorage.patch({ entered: true });
    await expect(backgroundAttendanceStorage.get()).resolves.toBeNull();
  });
});

describe("tokenStorage", () => {
  it("トークンを保存・削除できる", async () => {
    await tokenStorage.set("abc");
    await expect(tokenStorage.get()).resolves.toBe("abc");
    await tokenStorage.remove();
    await expect(tokenStorage.get()).resolves.toBeNull();
  });
});

describe("credentialStorage（Face ID 用のログイン情報）", () => {
  beforeEach(() => credentialStorage.remove());

  it("メールアドレスとパスワードを保存して読める", async () => {
    await credentialStorage.set({ email: "t@4nonome.com", password: "pw" });
    await expect(credentialStorage.get()).resolves.toEqual({
      email: "t@4nonome.com",
      password: "pw",
    });
  });

  it("どちらかが空なら保存しない", async () => {
    await credentialStorage.set({ email: "t@4nonome.com", password: "" });
    await expect(credentialStorage.get()).resolves.toBeNull();
  });
});

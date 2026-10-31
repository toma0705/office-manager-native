jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

import * as Location from "expo-location";
import { requestLocationPermission } from "../permissions";

const location = Location as jest.Mocked<typeof Location>;
const status = (value: string, canAskAgain = true) =>
  ({ status: value, canAskAgain }) as never;

describe("requestLocationPermission", () => {
  beforeEach(() => jest.clearAllMocks());

  it("すでに許可されていれば、聞かずに true", async () => {
    location.getBackgroundPermissionsAsync.mockResolvedValue(status("granted"));
    await expect(requestLocationPermission("background")).resolves.toBe(true);
    expect(location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("まだなら聞き、許可されれば true", async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue(
      status("undetermined")
    );
    location.requestForegroundPermissionsAsync.mockResolvedValue(
      status("granted")
    );
    await expect(requestLocationPermission("foreground")).resolves.toBe(true);
  });

  it("もう聞けない（設定で拒否された）なら、聞かずに false", async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue(
      status("denied", false)
    );
    await expect(requestLocationPermission("foreground")).resolves.toBe(false);
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("聞いて拒否されたら false", async () => {
    location.getBackgroundPermissionsAsync.mockResolvedValue(
      status("undetermined")
    );
    location.requestBackgroundPermissionsAsync.mockResolvedValue(
      status("denied")
    );
    await expect(requestLocationPermission("background")).resolves.toBe(false);
  });
});

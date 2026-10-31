jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

import * as LocalAuthentication from "expo-local-authentication";
import { authenticateWithBiometrics } from "../biometrics";

const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

describe("authenticateWithBiometrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.hasHardwareAsync.mockResolvedValue(true);
    auth.isEnrolledAsync.mockResolvedValue(true);
  });

  it("本人だと確かめられたら ok", async () => {
    auth.authenticateAsync.mockResolvedValue({ success: true } as never);
    await expect(authenticateWithBiometrics("確認")).resolves.toEqual({
      ok: true,
    });
    expect(auth.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: "確認",
        disableDeviceFallback: false,
      })
    );
  });

  it("端末が対応していない・設定していないなら、確認を出さない", async () => {
    auth.hasHardwareAsync.mockResolvedValueOnce(false);
    await expect(authenticateWithBiometrics("確認")).resolves.toEqual({
      ok: false,
      reason: "no-hardware",
    });

    auth.isEnrolledAsync.mockResolvedValueOnce(false);
    await expect(authenticateWithBiometrics("確認")).resolves.toEqual({
      ok: false,
      reason: "not-enrolled",
    });
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
  });

  it("キャンセルと失敗を分ける", async () => {
    auth.authenticateAsync.mockResolvedValueOnce({
      success: false,
      error: "user_cancel",
    } as never);
    await expect(authenticateWithBiometrics("確認")).resolves.toEqual({
      ok: false,
      reason: "cancelled",
    });

    auth.authenticateAsync.mockResolvedValueOnce({
      success: false,
      error: "authentication_failed",
    } as never);
    await expect(authenticateWithBiometrics("確認")).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("Info.plist に Face ID の説明がないときの警告を見分ける", async () => {
    auth.authenticateAsync.mockResolvedValueOnce({
      success: false,
      error: "not_available",
      warning:
        "FaceID is available but has not been configured. NSFaceIDUsageDescription",
    } as never);
    await expect(authenticateWithBiometrics("確認")).resolves.toEqual({
      ok: false,
      reason: "missing-usage-description",
    });
  });
});

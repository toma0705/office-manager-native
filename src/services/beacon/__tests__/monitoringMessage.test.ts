import { monitoringMessage, type MonitoringResult } from "../monitoringMessage";

describe("monitoringMessage", () => {
  it("監視中なら、その旨を伝える", () => {
    expect(monitoringMessage({ started: true }, "ios")).toContain("監視中");
  });

  it("「常に許可」でないときは、OS ごとの設定の名前で案内する", () => {
    const denied: MonitoringResult = {
      started: false,
      reason: "background-denied",
    };
    expect(monitoringMessage(denied, "android")).toContain(
      "「常に許可」に変更"
    );
    expect(monitoringMessage(denied, "ios")).toContain("「常に」に変更");
  });

  it.each([
    "unsupported-office",
    "beacon-unavailable",
    "disclosure-declined",
    "foreground-denied",
    "bluetooth-denied",
  ] as const)("%s のときも説明を返す", reason => {
    expect(monitoringMessage({ started: false, reason }, "ios")).toEqual(
      expect.any(String)
    );
  });
});

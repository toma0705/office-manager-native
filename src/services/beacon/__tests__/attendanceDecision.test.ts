import fixture from "../../../../modules/office-beacon/test-fixtures/attendance-decisions.json";
import {
  ACTION_PATHS,
  decideBeaconAction,
  parseServerAttendance,
  type ServerAttendance,
} from "../attendanceDecision";

type ServerStateName = keyof typeof fixture.serverStates;

describe("decideBeaconAction（Android と共通の表）", () => {
  it.each(fixture.cases)("$name", ({ beacon, server, action }) => {
    const serverState: ServerAttendance =
      fixture.serverStates[server as ServerStateName];
    expect(
      decideBeaconAction(beacon as "inside" | "outside", serverState)
    ).toBe(action);
  });

  it("表はビーコンの状態とサーバーの状態の組み合わせをすべて含む", () => {
    const combinations = fixture.cases.map(c => `${c.beacon}:${c.server}`);
    const states = Object.keys(fixture.serverStates);
    expect(new Set(combinations).size).toBe(states.length * 2);
  });

  it("圏内の操作は /arrive、圏外の操作は /leave を呼ぶ", () => {
    expect(ACTION_PATHS).toEqual({
      requestEnter: "arrive",
      cancelExit: "arrive",
      requestExit: "leave",
      cancelEnter: "leave",
    });
  });
});

describe("parseServerAttendance", () => {
  it("保留の時刻から、保留中かどうかを読む", () => {
    expect(
      parseServerAttendance({
        entered: false,
        enterPendingSince: "2026-11-01T00:00:00Z",
        exitPendingSince: null,
      })
    ).toEqual({ entered: false, enterPending: true, exitPending: false });
    expect(
      parseServerAttendance({
        entered: true,
        exitPendingSince: "2026-11-01T00:00:00Z",
      })
    ).toEqual({ entered: true, enterPending: false, exitPending: true });
  });

  it("入室中なら入室の保留はなく、退室中なら退室の保留はない（ありえない組み合わせは無視）", () => {
    expect(
      parseServerAttendance({
        entered: true,
        enterPendingSince: "2026-11-01T00:00:00Z",
      })
    ).toEqual({ entered: true, enterPending: false, exitPending: false });
  });

  it.each([null, undefined, "x", {}, { entered: "yes" }])(
    "形が違えば null（%p）",
    value => {
      expect(parseServerAttendance(value)).toBeNull();
    }
  );
});

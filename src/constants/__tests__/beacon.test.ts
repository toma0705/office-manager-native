import { getOfficeBeacon } from "../beacon";

describe("getOfficeBeacon", () => {
  it("ビーコンを置いているオフィスなら、その設定を返す", () => {
    expect(getOfficeBeacon({ code: "OKAYAMA" })).toEqual({
      uuid: "12345678-1234-1234-1234-123456789ABC",
      major: 1,
      minor: 1,
    });
  });

  it.each([{ code: "TOKYO" }, { code: null }, null, undefined])(
    "置いていないオフィスや不明なら null（%p）",
    office => {
      expect(getOfficeBeacon(office)).toBeNull();
    }
  );
});

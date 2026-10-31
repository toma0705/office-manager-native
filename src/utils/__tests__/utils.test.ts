import { formatDateTime } from "../date";
import { sortOfficesByPriority, toOfficeOptions } from "../offices";
import { normalizeSize } from "../size";

describe("formatDateTime", () => {
  it("月/日 時:分 にする", () => {
    expect(formatDateTime(new Date(2026, 10, 1, 9, 5))).toBe("11/01 09:05");
  });

  it.each([null, undefined, "", "not a date"])(
    "日時でなければ - にする（%p）",
    input => {
      expect(formatDateTime(input)).toBe("-");
    }
  );
});

describe("sortOfficesByPriority", () => {
  it("東京・岡山を先にし、残りは名前順にする", () => {
    const offices = [
      { id: 3, code: "OSAKA", name: "大阪オフィス" },
      { id: 1, code: "OKAYAMA", name: "岡山オフィス" },
      { id: 2, code: "TOKYO", name: "東京オフィス" },
    ];
    expect(sortOfficesByPriority(offices).map(o => o.code)).toEqual([
      "TOKYO",
      "OKAYAMA",
      "OSAKA",
    ]);
    // 元の配列は並べ替えない
    expect(offices[0].code).toBe("OSAKA");
  });
});

describe("toOfficeOptions", () => {
  it("選択肢にする（名前がなければコードを出す）", () => {
    expect(
      toOfficeOptions([
        { id: 1, code: "OKAYAMA", name: "岡山オフィス" },
        { id: 9, code: "NEW", name: "" },
      ])
    ).toEqual([
      { value: "OKAYAMA", label: "岡山オフィス" },
      { value: "NEW", label: "NEW" },
    ]);
  });
});

describe("normalizeSize", () => {
  it("名前のサイズを数値にし、不正なら既定値にする", () => {
    expect(normalizeSize("large")).toBe(48);
    expect(normalizeSize(12)).toBe(12);
    expect(normalizeSize(Number.NaN, 5)).toBe(5);
    expect(normalizeSize(undefined)).toBe(28);
  });
});

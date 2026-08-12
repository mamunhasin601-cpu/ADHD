import {
  formatClockTime,
  formatWallClock,
  parseClockInput,
} from "./time-format";

describe("time-format contract", () => {
  const midnight = new Date("2026-01-01T00:05:00.000Z");
  it("resolves SYSTEM to simulated 24-hour device convention", () =>
    expect(
      formatClockTime(midnight, "SYSTEM", {
        locale: "en-GB",
        timeZone: "UTC",
        deviceHourCycle: "h23",
      }),
    ).toBe("00:05"));
  it("resolves SYSTEM to simulated 12-hour device convention", () =>
    expect(
      formatClockTime(midnight, "SYSTEM", {
        locale: "en-US",
        timeZone: "UTC",
        deviceHourCycle: "h12",
      }),
    ).toBe("12:05 AM"));
  it("respects locale independently in H12", () =>
    expect(
      formatClockTime(new Date("2026-01-01T14:30Z"), "H12", {
        locale: "en-US",
        timeZone: "UTC",
      }),
    ).toBe("2:30 PM"));
  it("respects locale independently in H24", () =>
    expect(
      formatClockTime(new Date("2026-01-01T14:30Z"), "H24", {
        locale: "en-GB",
        timeZone: "UTC",
      }),
    ).toBe("14:30"));
  it("formats H24 midnight and leading zero", () =>
    expect(formatWallClock(0, 3, "H24", { locale: "en-GB" })).toBe("00:03"));
  it("distinguishes H12 midnight and noon", () => {
    expect(formatWallClock(0, 0, "H12", { locale: "en-US" })).toBe("12:00 AM");
    expect(formatWallClock(12, 0, "H12", { locale: "en-US" })).toBe("12:00 PM");
  });
  it("supports an explicit IANA timezone", () =>
    expect(
      formatClockTime(new Date("2026-01-01T12:30Z"), "H24", {
        locale: "en-GB",
        timeZone: "Europe/Moscow",
      }),
    ).toBe("15:30"));
  it.each([
    ["12:00 AM", 0, 0],
    ["12:00 PM", 12, 0],
    ["2:30 PM", 14, 30],
  ] as const)("parses %s", (value, h, m) =>
    expect(parseClockInput(value, "H12")).toEqual({ hours: h, minutes: m }),
  );
  it.each(["2:30", "00:30 AM", "13:00 PM", "12:60 PM", "nonsense"])(
    "rejects ambiguous or invalid H12 input %s",
    (value) => expect(parseClockInput(value, "H12")).toBeNull(),
  );
  it("parses H24 and rejects out of range", () => {
    expect(parseClockInput("14:30", "H24")).toEqual({ hours: 14, minutes: 30 });
    expect(parseClockInput("24:00", "H24")).toBeNull();
  });
  it("does not mutate the Date or timestamp", () => {
    const d = new Date("2026-01-01T12:30Z");
    const before = d.getTime();
    formatClockTime(d, "H12", { locale: "en-US", timeZone: "Asia/Tokyo" });
    expect(d.getTime()).toBe(before);
  });
});

import { describe, expect, it } from "vitest";
import { advanceMonth, formatChineseDate, isInDateWindow, monthsBetween } from "../core/calendar";
import { createRandom } from "../core/random";

describe("calendar", () => {
  it("advances across year boundaries", () => {
    expect(advanceMonth("1573-01")).toBe("1573-02");
    expect(advanceMonth("1573-12")).toBe("1574-01");
  });

  it("checks date windows and labels", () => {
    expect(isInDateWindow("1582-07", "1582-07", "1582-12")).toBe(true);
    expect(isInDateWindow("1583-01", "1582-07", "1582-12")).toBe(false);
    expect(formatChineseDate("1619-03")).toBe("1619年3月");
    expect(monthsBetween("1573-01", "1574-01")).toBe(12);
  });
});

describe("fixed seed random", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = createRandom(1573);
    const b = createRandom(1573);
    expect([a.next(), a.next(), a.int(1, 10)]).toEqual([b.next(), b.next(), b.int(1, 10)]);
  });

  it("rejects empty picks", () => {
    const random = createRandom(1);
    expect(() => random.pick([])).toThrow("Cannot pick from an empty array");
  });
});

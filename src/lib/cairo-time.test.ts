import { describe, expect, it } from "vitest";
import { cairoOffsetMs, cairoNow, cairoMidnightUtcIso, cairoHourUtcMs } from "./cairo-time";

const HOUR = 60 * 60 * 1000;

/** Cairo wall-clock "YYYY-MM-DD HH" for an instant, straight from Intl (independent oracle). */
function cairoWall(at: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${String(Number(p.hour) % 24).padStart(2, "0")}`;
}

/**
 * Derive real DST transition instants from tzdata by scanning hour-by-hour for
 * offset changes. No hardcoded calendar dates.
 */
function findTransitions(fromYear: number, years = 2) {
  const start = Date.UTC(fromYear, 0, 1);
  const end = Date.UTC(fromYear + years, 0, 1);
  const out: { at: number; before: number; after: number }[] = [];
  let prev = cairoOffsetMs(new Date(start));
  for (let t = start + HOUR; t <= end; t += HOUR) {
    const cur = cairoOffsetMs(new Date(t));
    if (cur !== prev) {
      // narrow to the minute
      let lo = t - HOUR;
      let hi = t;
      while (hi - lo > 60_000) {
        const mid = lo + Math.floor((hi - lo) / 2 / 60_000) * 60_000;
        if (mid === lo) break;
        if (cairoOffsetMs(new Date(mid)) === prev) lo = mid;
        else hi = mid;
      }
      out.push({ at: hi, before: prev, after: cur });
      prev = cur;
    }
  }
  return out;
}

const YEAR = new Date().getUTCFullYear();
const transitions = findTransitions(YEAR, 2);

describe("cairo-time DST transitions (derived from tzdata)", () => {
  it("finds spring-forward and fall-back transitions for the current + next cycle", () => {
    expect(transitions.length).toBeGreaterThanOrEqual(2);
  });

  for (const tr of transitions) {
    const kind = tr.after > tr.before ? "spring-forward" : "fall-back";
    const label = `${kind} at ${new Date(tr.at).toISOString()}`;

    it(`${label}: last moment before keeps the old offset`, () => {
      const before = new Date(tr.at - 1000);
      expect(cairoOffsetMs(before)).toBe(tr.before);
      expect(cairoNow(before).getTime()).toBe(before.getTime() + tr.before);
    });

    it(`${label}: first moment at/after uses the new offset`, () => {
      const after = new Date(tr.at);
      expect(cairoOffsetMs(after)).toBe(tr.after);
      expect(cairoNow(after).getTime()).toBe(after.getTime() + tr.after);
    });

    it(`${label}: day/hour bucket matches Intl on both sides`, () => {
      for (const at of [new Date(tr.at - 1000), new Date(tr.at), new Date(tr.at + HOUR)]) {
        const c = cairoNow(at);
        const bucket = `${c.getUTCFullYear()}-${String(c.getUTCMonth() + 1).padStart(2, "0")}-${String(
          c.getUTCDate(),
        ).padStart(2, "0")} ${String(c.getUTCHours()).padStart(2, "0")}`;
        expect(bucket).toBe(cairoWall(at));
      }
    });

    it(`${label}: cairoMidnightUtcIso lands on Cairo 00:00 of the same Cairo day`, () => {
      for (const at of [new Date(tr.at - 1000), new Date(tr.at), new Date(tr.at + HOUR)]) {
        const midnight = new Date(cairoMidnightUtcIso(at));
        expect(midnight.getTime()).toBeLessThanOrEqual(at.getTime());
        // Egypt springs forward at Cairo 00:00, so on that day local midnight
        // does not exist and the day legitimately starts at 01:00.
        expect(["00", "01"]).toContain(cairoWall(midnight).slice(11));
        expect(cairoWall(midnight).slice(0, 10)).toBe(cairoWall(at).slice(0, 10));
      }
    });

    it(`${label}: cairoHourUtcMs maps back to the requested Cairo hour`, () => {
      for (const at of [new Date(tr.at - 1000), new Date(tr.at + HOUR)]) {
        for (const h of [0, 6, 12, 23]) {
          const inst = new Date(cairoHourUtcMs(h, at));
          const got = Number(cairoWall(inst).slice(11));
          // A skipped hour (spring-forward) resolves to the next existing hour.
          expect(got === h || got === h + 1).toBe(true);
        }
      }
    });
  }
});

describe("cairo-time offsets", () => {
  it("uses +2 (EET) in winter and +3 (EEST) in summer", () => {
    expect(cairoOffsetMs(new Date(Date.UTC(YEAR, 0, 15))) / HOUR).toBe(2);
    expect(cairoOffsetMs(new Date(Date.UTC(YEAR, 6, 15))) / HOUR).toBe(3);
  });
});

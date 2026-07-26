// DST-aware Africa/Cairo helpers. Egypt observes EEST (UTC+3) from the last
// Friday of April through the last Thursday of October, else EET (UTC+2).
// We derive the offset from Intl instead of hardcoding, so DST transitions
// are handled correctly by the runtime (no manual date tables to maintain).

export function cairoOffsetMs(at: Date = new Date()): number {
  // Format the same instant in Cairo and UTC, subtract → offset in ms.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const cairoAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return cairoAsUtc - at.getTime();
}

export function cairoNow(at: Date = new Date()): Date {
  return new Date(at.getTime() + cairoOffsetMs(at));
}

/**
 * Convert a Cairo wall-clock instant (expressed as a UTC-shifted Date) back to
 * the real UTC instant. The offset at the target may differ from the offset at
 * the reference time (DST transition days), so we re-resolve it once.
 */
function cairoWallToUtcMs(wallUtcMs: number, refOffset: number): number {
  let utcMs = wallUtcMs - refOffset;
  const settled = cairoOffsetMs(new Date(utcMs));
  if (settled !== refOffset) utcMs = wallUtcMs - settled;
  return utcMs;
}

/** UTC ISO string for the most recent Cairo local midnight. */
export function cairoMidnightUtcIso(at: Date = new Date()): string {
  const off = cairoOffsetMs(at);
  const c = new Date(at.getTime() + off);
  const wall = Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate());
  return new Date(cairoWallToUtcMs(wall, off)).toISOString();
}

/** UTC ms for a given Cairo local hour today. */
export function cairoHourUtcMs(hour: number, at: Date = new Date()): number {
  const off = cairoOffsetMs(at);
  const c = new Date(at.getTime() + off);
  const wall = Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate(), hour);
  return cairoWallToUtcMs(wall, off);
}

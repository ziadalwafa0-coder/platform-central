// @ts-nocheck
export const BUSINESS_TIMEZONE = "Africa/Cairo";

export function getHourAdjustmentMs(): number {
  if (typeof window !== "undefined") {
    let saved = localStorage.getItem("cairo_clock_offset");
    if (saved === null) {
      saved = "-1";
      localStorage.setItem("cairo_clock_offset", "-1");
    }
    const offset = parseInt(saved, 10);
    return (Number.isNaN(offset) ? -1 : offset) * 60 * 60 * 1000;
  }
  return -1 * 60 * 60 * 1000;
}

export function getBrowserClockOffset(): number {
  if (typeof window === "undefined") return -1;
  const saved = localStorage.getItem("cairo_clock_offset");
  if (saved !== null) {
    const val = parseInt(saved, 10);
    return Number.isNaN(val) ? -1 : val;
  }
  return -1;
}

export function setBrowserClockOffset(offset: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("cairo_clock_offset", String(offset));
}

export function getCairoTodayStr(date: Date | string | number = new Date()): string {
  const d = new Date(date);
  const adjustedDate = new Date(d.getTime() + getHourAdjustmentMs());
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(adjustedDate);
}

export function getCairoDateKey(input: Date | string | number): string {
  return getCairoTodayStr(input);
}

export function getCairoHour24(input: Date | string | number = new Date()): number {
  const d = new Date(input);
  const adjustedDate = new Date(d.getTime() + getHourAdjustmentMs());
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const hour = parseInt(formatter.format(adjustedDate), 10);
  return isNaN(hour) ? 0 : hour;
}

export function getCairoMinute(input: Date | string | number): number {
  const date = new Date(input);
  const adjustedDate = new Date(date.getTime() + getHourAdjustmentMs());
  return parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: BUSINESS_TIMEZONE,
      minute: "2-digit",
    }).format(adjustedDate),
    10
  );
}

export function getCairoTenMinuteSlot(input: Date | string | number): number {
  const minute = getCairoMinute(input);
  return Math.floor(minute / 10);
}

export function addDaysToDateStr(dateStr: string, offsetDays: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function getCairoYesterdayStr(): string {
  return addDaysToDateStr(getCairoTodayStr(), -1);
}

export function formatCairoTime(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "وقت غير صالح";
  }
  const adjustedDate = new Date(date.getTime() + getHourAdjustmentMs());
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(adjustedDate);
}

export function formatCairoTimeShort(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  const adjustedDate = new Date(date.getTime() + getHourAdjustmentMs());
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(adjustedDate);
}

export function getNextScheduledSyncCountdown(
  cairoTime: Date,
  schedulerEnabled: boolean,
  schedulerIntervalMinutes: number,
  nextScheduledSyncAtIso?: string | null
) {
  if (!schedulerEnabled) {
    return {
      countdownStr: "معطلة",
      targetCairoTimeStr: "غير محدد",
      totalSeconds: 0,
    };
  }

  let targetTimeMs = 0;
  if (nextScheduledSyncAtIso) {
    const parsedTarget = new Date(nextScheduledSyncAtIso).getTime();
    if (!isNaN(parsedTarget)) {
      targetTimeMs = parsedTarget;
    }
  }

  const nowMs = cairoTime.getTime();

  // If no target or target is in the past, calculate anchored next run
  if (!targetTimeMs || targetTimeMs <= nowMs) {
    const intervalMs = Math.max(1, schedulerIntervalMinutes) * 60 * 1000;
    const topOfHourMs = Math.floor(nowMs / (3600 * 1000)) * (3600 * 1000);
    let candidateMs = topOfHourMs;
    while (candidateMs <= nowMs) {
      candidateMs += intervalMs;
    }
    targetTimeMs = candidateMs;
  }

  let diffMs = targetTimeMs - nowMs;
  if (diffMs < 0) diffMs = 0;

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const countdownStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const targetCairoTimeStr = formatCairoTimeShort(new Date(targetTimeMs));

  return {
    countdownStr,
    targetCairoTimeStr,
    totalSeconds,
  };
}


export const cairoFormatter = {
  format: (date: Date) => formatCairoTime(date)
};

export function getCairoOffset(date: Date = new Date()): number {
  const adjustedDate = new Date(date.getTime() + getHourAdjustmentMs());
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).formatToParts(adjustedDate);
  const cairoHour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const utcParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    hour12: false,
  }).formatToParts(adjustedDate);
  const utcHour = Number(utcParts.find((p) => p.type === "hour")?.value ?? 0);
  let offset = cairoHour - utcHour;
  if (offset < -12) offset += 24;
  if (offset > 12) offset -= 24;
  return offset;
}

export function formatCairoHourArabic(hour: number): string {
  return `${normalizeHour24(hour)}:00`;
}

export function normalizeHour24(hour: number): number {
  return hour >= 24 ? hour % 24 : hour;
}

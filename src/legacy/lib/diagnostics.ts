// @ts-nocheck
export function logTimeDiagnostics() {
  const now = new Date();
  console.table({
    utcIso: now.toISOString(),
    browserLocal: now.toString(),
    browserOffsetMinutes: now.getTimezoneOffset(),
    cairoFormatted: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Cairo",
      dateStyle: "full",
      timeStyle: "long",
    }).format(now),
  });
}

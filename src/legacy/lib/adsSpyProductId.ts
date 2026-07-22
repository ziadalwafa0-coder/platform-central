const prefixes: Record<string, string> = { prod: "1", snap: "2", run: "3", conn: "4" };

export function toAdsSpyProductId(id: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id.toLowerCase();
  const [prefix, value] = id.split("_");
  if (!prefixes[prefix] || !value) return id;
  const hex = value.replace(/[^0-9a-f]/gi, "").padEnd(12, "0").slice(0, 12);
  return `${prefixes[prefix]}0000000-0000-0000-0000-${hex}`;
}

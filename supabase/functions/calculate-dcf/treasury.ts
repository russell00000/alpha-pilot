export function parseTreasuryYield(xml: string) {
  const entries = xml.match(/<(?:\w+:)?entry\b[^>]*>[\s\S]*?<\/(?:\w+:)?entry>/g) ?? [];
  const observations = entries.flatMap((entry) => {
    const date = entry.match(/<(?:\w+:)?NEW_DATE\b[^>]*>([^<]+)</)?.[1]?.slice(0, 10);
    const text = entry.match(/<(?:\w+:)?BC_10YEAR\b[^>]*>([^<]+)</)?.[1];
    const percent = text ? Number(text) : NaN;
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(percent) ? [{ date, rate: percent / 100 }] : [];
  }).sort((a, b) => b.date.localeCompare(a.date));
  const latest = observations[0];
  if (!latest) throw new Error("Treasury returned no valid 10-year yield observations.");
  return latest;
}
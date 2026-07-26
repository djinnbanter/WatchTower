export const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export const weekdayDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export const hmsTimeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Hover title: `Wed, Jul 22 · 14:35:23` */
export function formatChartHoverTitle(date: Date): string {
  return `${weekdayDateFmt.format(date)} · ${hmsTimeFmt.format(date)}`;
}

/** Compact date+time (rare); axis ticks prefer `hmsTimeFmt` alone. */
export function formatChartHoverLabel(date: Date): string {
  return `${shortDateFmt.format(date)} ${hmsTimeFmt.format(date)}`;
}

// `Intl.NumberFormat.prototype.format` is a bound getter — safe to extract.
export const intFmt = new Intl.NumberFormat("en-US").format;

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

/** Axis ticks: omit seconds so Live's sliding domain does not rewrite labels every 1s. */
export const hmTimeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Match `dateLabels` / Live axis: time-only under ~36h, else calendar day. */
export const CHART_AXIS_TIME_SPAN_MS = 36 * 60 * 60 * 1000;

/** Bottom X-axis tick label for a domain-spaced tick. */
export function formatChartAxisTick(date: Date, domainSpanMs: number): string {
  return domainSpanMs < CHART_AXIS_TIME_SPAN_MS
    ? hmTimeFmt.format(date)
    : shortDateFmt.format(date);
}

/** Hover title: `Wed, Jul 22 · 14:35:23` */
export function formatChartHoverTitle(date: Date): string {
  return `${weekdayDateFmt.format(date)} · ${hmsTimeFmt.format(date)}`;
}

/** Compact date+time (rare); axis ticks prefer `hmTimeFmt` alone. */
export function formatChartHoverLabel(date: Date): string {
  return `${shortDateFmt.format(date)} ${hmsTimeFmt.format(date)}`;
}

// `Intl.NumberFormat.prototype.format` is a bound getter — safe to extract.
export const intFmt = new Intl.NumberFormat("en-US").format;

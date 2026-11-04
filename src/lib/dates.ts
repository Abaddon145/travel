const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

export function parseIsoDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatMonthDay(iso: string) {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatDateWithWeekday(iso: string) {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return `${formatMonthDay(iso)} 周${weekdays[date.getDay()]}`;
}

export function formatDateRange(start: string, end: string) {
  return `${formatMonthDay(start)} – ${formatMonthDay(end)}`;
}

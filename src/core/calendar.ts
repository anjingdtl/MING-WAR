export function advanceMonth(date: string): string {
  const [yearText, monthText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function monthIndex(date: string): number {
  const [yearText, monthText] = date.split("-");
  return Number(yearText) * 12 + Number(monthText) - 1;
}

export function monthsBetween(start: string, end: string): number {
  return monthIndex(end) - monthIndex(start);
}

export function isAfter(date: string, target: string): boolean {
  return monthIndex(date) > monthIndex(target);
}

export function isInDateWindow(date: string, start: string, end: string): boolean {
  const value = monthIndex(date);
  return value >= monthIndex(start) && value <= monthIndex(end);
}

export function formatChineseDate(date: string): string {
  const [year, month] = date.split("-");
  return `${year}年${Number(month)}月`;
}

import { addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const DIGEST_TIME_ZONE = "America/New_York";

export function formatDateInET(date = new Date()): string {
  const zoned = toZonedTime(date, DIGEST_TIME_ZONE);
  const year = zoned.getFullYear();
  const month = `${zoned.getMonth() + 1}`.padStart(2, "0");
  const day = `${zoned.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getETDateWindow(date: string): { start: Date; end: Date } {
  const start = fromZonedTime(`${date} 00:00:00`, DIGEST_TIME_ZONE);
  const nextDate = addDays(new Date(`${date}T00:00:00.000Z`), 1).toISOString().slice(0, 10);
  const end = fromZonedTime(`${nextDate} 00:00:00`, DIGEST_TIME_ZONE);
  return { start, end };
}

export function isWithinETDate(value: string | Date | undefined, date: string): boolean {
  if (!value) return false;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const { start, end } = getETDateWindow(date);
  return parsed >= start && parsed < end;
}

export function isWithinETLookback(value: string | Date | undefined, date: string, hours: number): boolean {
  if (!value) return false;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const { end } = getETDateWindow(date);
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return parsed >= start && parsed < end;
}

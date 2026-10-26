import {
  addDays,
  endOfMonth,
  format,
  isAfter,
  parseISO,
  startOfMonth,
} from "date-fns";
import { zhCN } from "date-fns/locale";

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function fromDateKey(dateKey: string): Date {
  return parseISO(`${dateKey}T12:00:00`);
}

export function todayKey(now = new Date()): string {
  return toDateKey(now);
}

export function formatLongDate(date: Date): string {
  return format(date, "M月d日 EEEE", { locale: zhCN });
}

export function formatMonth(date: Date): string {
  return format(date, "yyyy年 M月", { locale: zhCN });
}

export function formatShortDate(dateKey: string): string {
  return format(fromDateKey(dateKey), "M月d日 EEEE", { locale: zhCN });
}

export function shiftDate(dateKey: string, amount: number): string {
  return toDateKey(addDays(fromDateKey(dateKey), amount));
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isDateAfter(a: string, b: string): boolean {
  return isAfter(fromDateKey(a), fromDateKey(b));
}

export interface CalendarCell {
  date: Date;
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

export function getCalendarCells(month: Date): CalendarCell[] {
  const firstDay = startOfMonth(month);
  const lastDay = endOfMonth(month);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const start = addDays(firstDay, -mondayOffset);
  const totalCells = Math.ceil((mondayOffset + lastDay.getDate()) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const date = addDays(start, index);
    return {
      date,
      dateKey: toDateKey(date),
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
}

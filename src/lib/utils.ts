import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeFormat(date: any, formatStr: string, options?: any) {
  if (!date) return 'N/A';
  
  let dateObj: Date;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = parseISO(date);
  } else {
    return 'N/A';
  }

  if (!isValid(dateObj)) return 'N/A';
  
  try {
    return format(dateObj, formatStr, options);
  } catch (e) {
    return 'N/A';
  }
}

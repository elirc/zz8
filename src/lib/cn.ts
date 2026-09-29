/**
 * What this file does: merges Tailwind class names predictably.
 * What calls it: UI components across src/components/.
 * What it calls: clsx and tailwind-merge.
 * One thing a junior engineer would likely get wrong when writing something similar: concatenating classes manually and accidentally letting stale variants win.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

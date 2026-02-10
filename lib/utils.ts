import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for safe Tailwind class composition.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

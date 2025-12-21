import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function getHumanReadableBucketName(bucketId: string, bucketLabel?: string): string {
  if (bucketLabel) return bucketLabel;
  if (bucketId.startsWith("aw-watcher-afk_")) return "AFK / Idle";
  if (bucketId.startsWith("aw-watcher-window_")) return "Active Window";
  if (bucketId.startsWith("aw-watcher-web-chrome_")) return "Chrome Web";
  if (bucketId.includes("vscode")) return "VS Code";
  if (bucketId === "aw-watcher-manual-nextjs") return "Manual Entries";
  return bucketId;
}

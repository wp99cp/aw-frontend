import { Event } from "./types";

export interface ZoomRange {
    start: number; // minutes
    end: number;   // minutes
}

export interface Session {
    start: number;
    end: number;
}

export function calculateSessions(autoEvents: Event[], manualEvents: Event[]): Session[] {
    if (autoEvents.length === 0 && manualEvents.length === 0) return [];

    // 1. Flatten to intervals
    const intervals: Session[] = [];
    const process = (e: Event) => {
        const d = new Date(e.timestamp);
        const s = d.getHours() * 60 + d.getMinutes();
        const end = s + (e.duration / 60);
        intervals.push({ start: s, end });
    };
    autoEvents.forEach(process);
    manualEvents.forEach(process);

    if (intervals.length === 0) return [];

    // 2. Sort
    intervals.sort((a, b) => a.start - b.start);

    // 3. Merge & Split by Gap
    const result: Session[] = [];
    let current = { ...intervals[0] };

    for (let i = 1; i < intervals.length; i++) {
        const next = intervals[i];
        const gap = next.start - current.end;

        if (gap > 30) {
            // Gap > 30 mins, push current and start new
            result.push(current);
            current = { ...next };
        } else {
            // Merge (overlap or small gap)
            current.end = Math.max(current.end, next.end);
        }
    }
    result.push(current);
    return result;
}

export function calculateZoomRange(sessions: Session[]): ZoomRange {
    if (sessions.length === 0) {
        return { start: 0, end: 1440 };
    }

    const first = sessions[0].start;
    const last = sessions[sessions.length - 1].end;
    const padding = 60; // 1 hour padding
    const zStart = Math.max(0, first - padding);
    const zEnd = Math.min(1440, last + padding);

    return { start: zStart, end: zEnd };
}

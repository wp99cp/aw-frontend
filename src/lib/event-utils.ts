import { Event } from "@/lib/types";

// Helper function to generate meaningful event preview
export function getEventPreview(event: Event): { primary: string; secondary?: string } {
    const data = event.data;

    // For VS Code / editor events - show project name first, filename second
    if (data.file) {
        const filename = (data.file as string).split('/').pop() || data.file;
        const project = data.project ? (data.project as string).split('/').pop() : undefined;
        return {
            primary: project || filename as string,
            secondary: project ? filename as string : undefined
        };
    }

    // For web events - use title first, then url
    if (data.title) {
        return { primary: data.title };
    }

    if (data.url) {
        return { primary: data.url };
    }

    // For AFK events - show status
    if (data.status) {
        return { primary: data.status === 'not-afk' ? 'Active' : 'Away from keyboard' };
    }

    // For window events - use title (already has app shown separately)
    if (data.app && !data.title && !data.file) {
        return { primary: data.app };
    }

    return { primary: "Untitled" };
}

/**
 * Calculates the total duration of a list of events, handling overlapping time ranges.
 * Instead of simply summing durations, it merges overlapping intervals.
 */
export function calculateEffectiveDuration(events: Event[]): number {
    if (!events || events.length === 0) return 0;

    // Create intervals [start, end]
    const intervals = events.map(e => {
        const start = new Date(e.timestamp).getTime();
        const end = start + (e.duration * 1000); // duration is in seconds
        return { start, end };
    });

    // Sort by start time
    intervals.sort((a, b) => a.start - b.start);

    let totalDurationMs = 0;
    let currentInterval = intervals[0];

    for (let i = 1; i < intervals.length; i++) {
        const nextInterval = intervals[i];

        if (nextInterval.start < currentInterval.end) {
            // Overlap: extend current interval end if needed
            if (nextInterval.end > currentInterval.end) {
                currentInterval.end = nextInterval.end;
            }
        } else {
            // No overlap: add current interval to total and move to next
            totalDurationMs += (currentInterval.end - currentInterval.start);
            currentInterval = nextInterval;
        }
    }

    // Add the last interval
    totalDurationMs += (currentInterval.end - currentInterval.start);

    return totalDurationMs / 1000; // Return in seconds
}

"use client";

import { cn } from "@/lib/utils";
import { ZoomRange } from "./TimelineView";

interface TimeAxisProps {
    zoomRange?: ZoomRange;
}

export function TimeAxis({ zoomRange = { start: 0, end: 1440 } }: TimeAxisProps) {
    const totalMinutes = zoomRange.end - zoomRange.start;

    // Determine interval based on zoom level
    let interval = 60; // default 1h
    if (totalMinutes <= 60) interval = 5;       // < 1h visible -> 5 min ticks
    else if (totalMinutes <= 180) interval = 15; // < 3h visible -> 15 min ticks
    else if (totalMinutes <= 360) interval = 30; // < 6h visible -> 30 min ticks
    else if (totalMinutes <= 720) interval = 60; // < 12h visible -> 1h ticks (standard)
    else interval = 60; // > 12h visible -> 1h ticks

    const startMinute = Math.floor(zoomRange.start / interval) * interval;
    const ticks: number[] = [];

    for (let m = startMinute; m <= zoomRange.end; m += interval) {
        if (m >= zoomRange.start) {
            ticks.push(m);
        }
    }

    const ft = (m: number) => {
        const h = Math.floor(m / 60);
        const min = m % 60;
        return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    };

    return (
        <div className="relative h-6 w-full text-xs text-muted-foreground select-none">
            {ticks.map((t) => {
                const percent = ((t - zoomRange.start) / totalMinutes) * 100;
                return (
                    <div
                        key={t}
                        className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center transition-all duration-300 ease-in-out"
                        style={{ left: `${percent}%` }}
                    >
                        {/* Tick mark */}
                        <div className="h-2 w-px bg-border mb-1" />

                        <span className={cn(
                            "hidden md:inline whitespace-nowrap",
                            // Show all calculated ticks? Or filter more for density?
                            // With dynamic interval, density should be constant.
                        )}>
                            {ft(t)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

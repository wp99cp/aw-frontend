"use client";

import React, { useState, useEffect } from "react";
import { Event } from "@/lib/types";
import { cn, getHumanReadableBucketName } from "@/lib/utils";
import { TimeAxis } from "./TimeAxis";
import { AutoLane } from "./AutoLane";
import { ManualLane } from "./ManualLane";
import { EventForm } from "@/components/events/EventForm";
import { EventModal } from "@/components/events/EventModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelineViewProps {
    date: Date;
    autoEvents: Event[];
    manualEvents: Event[];
    onEventCreated: () => void;
}

export interface DraftSelection {
    start: number; // minutes
    end: number;   // minutes
    suggestedApp?: string;
}

export type ZoomRange = { start: number; end: number };

export function TimelineView({ date, autoEvents, manualEvents, onEventCreated }: TimelineViewProps) {
    const [draft, setDraft] = useState<DraftSelection | null>(null);
    const [zoomRange, setZoomRange] = useState<ZoomRange>({ start: 0, end: 1440 });
    const [guideLines, setGuideLines] = useState<number[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    // Track if we have set the initial zoom for the current data
    const [hasInitializedZoom, setHasInitializedZoom] = useState(false);
    // Track if buckets are expanded
    const [isExpanded, setIsExpanded] = useState(false);

    // Derived Sessions (Boot/Shutdowns)
    const sessions = (() => {
        if (autoEvents.length === 0 && manualEvents.length === 0) return [];

        // 1. Flatten to intervals
        const intervals: { start: number, end: number }[] = [];
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
        const result: { start: number, end: number }[] = [];
        let current = intervals[0];

        for (let i = 1; i < intervals.length; i++) {
            const next = intervals[i];
            const gap = next.start - current.end;

            if (gap > 30) {
                // Gap > 30 mins, push current and start new
                result.push(current);
                current = next;
            } else {
                // Merge (overlap or small gap)
                // We maximize the end time.
                current.end = Math.max(current.end, next.end);
            }
        }
        result.push(current);
        return result;
    })();

    // Extract snap points (start and end of sessions)
    // Extract snap points (start and end of sessions), rounded to 5 minutes
    const snapPoints = sessions.flatMap(s => [
        Math.round(s.start / 5) * 5,
        Math.round(s.end / 5) * 5
    ]);

    const isToday = new Date().toDateString() === date.toDateString();

    // Initial Zoom Effect (Use first session start and last session end)
    useEffect(() => {
        if (sessions.length > 0 && !hasInitializedZoom) {
            const first = sessions[0].start;
            const last = sessions[sessions.length - 1].end;
            const padding = 60; // 1 hour padding
            const zStart = Math.max(0, first - padding);
            const zEnd = Math.min(1440, last + padding);

            // Wrap in setTimeout to avoid synchronous setState warning
            setTimeout(() => {
                setZoomRange({ start: zStart, end: zEnd });
                setHasInitializedZoom(true);
            }, 0);
        }
    }, [sessions, hasInitializedZoom]);

    // Reset initialization when date changes (proxied by events changing substantially? or explicit date prop)
    useEffect(() => {
        setTimeout(() => {
            setHasInitializedZoom(false);
        }, 0);
    }, [date]);

    const handleEventCreated = () => {
        setDraft(null);
        setGuideLines([]);
        onEventCreated();
    };

    const handleEventUpdate = () => {
        setSelectedEvent(null);
        onEventCreated(); // Refresh data
    };

    const formatTime = (totalMinutes: number) => {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const getGuideStyle = (time: number) => {
        const totalVisible = zoomRange.end - zoomRange.start;
        const relative = time - zoomRange.start;
        const left = (relative / totalVisible) * 100;
        return { left: `${left}%` };
    };

    const groupedEvents = React.useMemo(() => {
        if (!isExpanded) return {};

        const groups = autoEvents.reduce((acc, event) => {
            const bucket = event.bucketId || "Unknown Bucket";
            if (!acc[bucket]) acc[bucket] = [];
            acc[bucket].push(event);
            return acc;
        }, {} as Record<string, Event[]>);

        // Sort keys
        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key];
            return acc;
        }, {} as Record<string, Event[]>);
    }, [autoEvents, isExpanded]);

    return (
        <div className="space-y-6">
            <div className="w-full border rounded-lg bg-background shadow-sm flex flex-col">
                <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                        Viewing {manualEvents.length} manual entries and {autoEvents.length} tracked events.
                    </div>
                    {/* Reset Zoom Button */}
                    {(zoomRange.start > 0 || zoomRange.end < 1440) && (
                        <button
                            onClick={() => setZoomRange({ start: 0, end: 1440 })}
                            className="text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded text-foreground transition-colors"
                        >
                            Reset Zoom
                        </button>
                    )}
                </div>

                <div className="relative w-full overflow-hidden">
                    <div className="min-w-full p-4 space-y-2">
                        <div className="relative">
                            {/* Session Markers (Red Lines) */}
                            {sessions.map((session, idx) => {
                                const isLast = idx === sessions.length - 1;
                                const showEnd = !(isToday && isLast);

                                return (
                                    <React.Fragment key={idx}>
                                        {/* Start Line */}
                                        {session.start >= zoomRange.start && session.start <= zoomRange.end && (
                                            <div
                                                className="absolute top-0 bottom-0 w-px bg-red-600 z-0 pointer-events-none opacity-50"
                                                style={getGuideStyle(session.start)}
                                            />
                                        )}
                                        {/* End Line */}
                                        {showEnd && session.end >= zoomRange.start && session.end <= zoomRange.end && (
                                            <div
                                                className="absolute top-0 bottom-0 w-px bg-red-600 z-0 pointer-events-none opacity-50"
                                                style={getGuideStyle(session.end)}
                                            />
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {/* Guide Lines */}
                            {guideLines.map((time, i) => {
                                if (time < zoomRange.start || time > zoomRange.end) return null;
                                return (
                                    <div
                                        key={i}
                                        className="absolute top-0 bottom-0 w-px bg-blue-500/50 border-r border-dashed border-blue-500 z-50 pointer-events-none"
                                        style={getGuideStyle(time)}
                                    />
                                );
                            })}

                            {/* Manual Entry Lane (Top) */}
                            <div className="mb-2 relative">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 relative z-10 bg-background inline-block pr-2">
                                    Projects / Manual Entries
                                </h4>
                                <ManualLane
                                    events={manualEvents}
                                    autoEvents={autoEvents}
                                    date={date}
                                    draft={draft}
                                    onDraftChange={setDraft}
                                    zoomRange={zoomRange}
                                    onGuideChange={setGuideLines}
                                    onEventClick={setSelectedEvent}
                                    snapPoints={snapPoints}
                                />
                            </div>

                            {/* Time Axis (Middle) */}
                            <TimeAxis zoomRange={zoomRange} />

                            {/* Auto Activity Lane (Bottom) */}
                            <div className="mt-2 relative">
                                <div className="flex items-center justify-between mb-2 relative z-10 bg-background pr-2">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Activity (Drag to Zoom)
                                    </h4>
                                    <button
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                                    >
                                        {isExpanded ? "Collapse Buckets" : "Expand Buckets"}
                                    </button>
                                </div>

                                {isExpanded ? (
                                    <div className="space-y-2">
                                        {Object.entries(groupedEvents).map(([bucketId, events]) => (
                                            <div key={bucketId} className="relative">
                                                <div className="text-[10px] text-muted-foreground mb-1 font-mono truncate max-w-[200px]" title={bucketId}>
                                                    {getHumanReadableBucketName(bucketId)}
                                                </div>
                                                <AutoLane
                                                    events={events}
                                                    zoomRange={zoomRange}
                                                    onZoomChange={setZoomRange}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <AutoLane
                                        events={autoEvents}
                                        zoomRange={zoomRange}
                                        onZoomChange={setZoomRange}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inline Editor / Placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle>{draft ? "Create Entry" : "Selection"}</CardTitle>
                </CardHeader>
                <CardContent>
                    {draft ? (
                        <div key={`${draft.start}-${draft.end}-${draft.suggestedApp}`} className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="mb-4 text-sm text-muted-foreground">
                                Selected Range: <span className="font-mono font-medium text-foreground">{formatTime(draft.start)} - {formatTime(draft.end)}</span> ({draft.end - draft.start} min)
                            </div>
                            <EventForm
                                initialValues={{
                                    date: date.toISOString().split("T")[0],
                                    time: formatTime(draft.start),
                                    durationMinutes: draft.end - draft.start,
                                    description: draft.suggestedApp || ""
                                }}
                                onSuccess={handleEventCreated}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                            <div className="text-lg font-semibold mb-2">No Time Selected</div>
                            <p>Drag on the <span className="font-medium text-foreground">Manual Entries</span> lane above to create a new time block.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <EventModal
                event={selectedEvent}
                isOpen={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onSave={handleEventUpdate}
            />
        </div>
    );
}

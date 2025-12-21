"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Event } from "@/lib/types";
import { cn, getHumanReadableBucketName } from "@/lib/utils";
import { TimeAxis } from "./TimeAxis";
import { AutoLane } from "./AutoLane";
import { ManualLane } from "./ManualLane";
import { EventForm } from "@/components/events/EventForm";
import { EventModal } from "@/components/events/EventModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Session, ZoomRange, calculateSessions } from "@/lib/timeline";
import { CategoryClass } from "@/lib/categories";
import { Loader2 } from "lucide-react";

interface TimelineViewProps {
    date: Date;
    autoEvents: Event[];
    manualEvents: Event[];
    onEventCreated: () => void;
    initialZoomRange?: ZoomRange;
    classes?: CategoryClass[];
    isExpanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
}

export interface DraftSelection {
    start: number; // minutes
    end: number;   // minutes
    suggestedCategory?: string;
}

export type { ZoomRange };

export function TimelineView({ date, autoEvents, manualEvents, onEventCreated, initialZoomRange, classes = [], isExpanded: externalIsExpanded, onExpandedChange }: TimelineViewProps) {
    const [draft, setDraft] = useState<DraftSelection | null>(null);
    const [zoomRange, setZoomRange] = useState<ZoomRange>(initialZoomRange || { start: 0, end: 1440 });
    const [guideLines, setGuideLines] = useState<number[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    // Track if buckets are expanded - use transition for smoother UX
    // Use external state if provided, otherwise use internal state
    const [internalIsExpanded, setInternalIsExpanded] = useState(false);
    const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
    const setIsExpanded = (value: boolean) => {
        if (onExpandedChange) {
            onExpandedChange(value);
        } else {
            setInternalIsExpanded(value);
        }
    };
    const [displayExpanded, setDisplayExpanded] = useState(isExpanded);
    const [isPending, startTransition] = useTransition();

    // Derived Sessions (Boot/Shutdowns)
    const sessions = React.useMemo(() => calculateSessions(autoEvents, manualEvents), [autoEvents, manualEvents]);

    // Extract snap points (start and end of sessions), rounded to 5 minutes
    const snapPoints = sessions.flatMap(s => [
        Math.round(s.start / 5) * 5,
        Math.round(s.end / 5) * 5
    ]);

    const isToday = new Date().toDateString() === date.toDateString();

    // Reset zoom when initialZoomRange changes (date change in parent)
    useEffect(() => {
        if (initialZoomRange) {
            setZoomRange(initialZoomRange);
        }
    }, [initialZoomRange]);

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
        if (!displayExpanded) return {};

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
    }, [autoEvents, displayExpanded]);

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
                                // Round to 5-minute intervals for alignment
                                const startRounded = Math.round(session.start / 5) * 5;
                                const endRounded = Math.round(session.end / 5) * 5;

                                return (
                                    <React.Fragment key={idx}>
                                        {/* Start Line */}
                                        {startRounded >= zoomRange.start && startRounded <= zoomRange.end && (
                                            <div
                                                className="absolute top-0 bottom-0 w-[2px] bg-red-600 z-0 pointer-events-none opacity-50"
                                                style={getGuideStyle(startRounded)}
                                            />
                                        )}
                                        {/* End Line */}
                                        {showEnd && endRounded >= zoomRange.start && endRounded <= zoomRange.end && (
                                            <div
                                                className="absolute top-0 bottom-0 w-[2px] bg-red-600 z-0 pointer-events-none opacity-50"
                                                style={getGuideStyle(endRounded)}
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
                                    classes={classes}
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
                                        onClick={() => {
                                            const newValue = !isExpanded;
                                            setIsExpanded(newValue);
                                            // Use transition to defer the expensive render
                                            startTransition(() => {
                                                setDisplayExpanded(newValue);
                                            });
                                        }}
                                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                                        disabled={isPending}
                                    >
                                        {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                        {isExpanded ? "Collapse Buckets" : "Expand Buckets"}
                                    </button>
                                </div>

                                {/* Show loading skeleton when transition is pending */}
                                {isPending && isExpanded && (
                                    <div className="space-y-2 animate-pulse">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="relative">
                                                <div className="h-3 w-24 bg-muted rounded mb-1" />
                                                <div className="h-16 w-full bg-muted/30 rounded-md border" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {isPending && !isExpanded && (
                                    <div className="animate-pulse">
                                        <div className="h-16 w-full bg-muted/30 rounded-md border" />
                                    </div>
                                )}

                                {/* Actual content - only render when not pending */}
                                {!isPending && displayExpanded ? (
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
                                                    classes={classes}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : !isPending ? (
                                    <AutoLane
                                        events={autoEvents}
                                        zoomRange={zoomRange}
                                        onZoomChange={setZoomRange}
                                        classes={classes}
                                    />
                                ) : null}
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
                        <div key={`${draft.start}-${draft.end}-${draft.suggestedCategory}`} className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="mb-4 text-sm text-muted-foreground">
                                Selected Range: <span className="font-mono font-medium text-foreground">{formatTime(draft.start)} - {formatTime(draft.end)}</span> ({draft.end - draft.start} min)
                            </div>
                            <EventForm
                                initialValues={{
                                    date: date.toISOString().split("T")[0],
                                    time: formatTime(draft.start),
                                    durationMinutes: draft.end - draft.start,
                                    title: draft.suggestedCategory || "",
                                    category: draft.suggestedCategory || ""
                                }}
                                categories={Array.from(new Set(classes.map(c => c.name.join(" > "))))}
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

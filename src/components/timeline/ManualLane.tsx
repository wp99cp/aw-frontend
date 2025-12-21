"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Event } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DraftSelection, ZoomRange } from "./TimelineView";

interface ManualLaneProps {
    date: Date;
    events: Event[];
    autoEvents: Event[];
    draft: DraftSelection | null;
    onDraftChange: (draft: DraftSelection | null) => void;
    zoomRange: ZoomRange;
    onGuideChange: (lines: number[]) => void;
    onEventClick?: (event: Event) => void;
    snapPoints?: number[];
}

export function ManualLane({ date, events, autoEvents, draft, onDraftChange, zoomRange, onGuideChange, onEventClick, snapPoints = [] }: ManualLaneProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dragMode, setDragMode] = useState<"create" | "move" | "resize-start" | "resize-end" | null>(null);

    // For "move" mode, we track the initial offset to keep relative position
    const [moveOffset, setMoveOffset] = useState<number>(0);
    const [anchor, setAnchor] = useState<number | null>(null);
    const [initialDraft, setInitialDraft] = useState<DraftSelection | null>(null);

    // Helper: Snap logic
    // Strong snap to snapPoints (e.g. boot times), then 5-min raster
    const snapTime = useCallback((rawMinutes: number) => {
        // 1. Check strong snap points (threshold: ~8 mins to be "stronger" than 5 min raster)
        const SNAP_THRESHOLD = 8;

        let bestSnap = -1;
        let minDist = Infinity;

        for (const pt of snapPoints) {
            const d = Math.abs(rawMinutes - pt);
            if (d < minDist) {
                minDist = d;
                bestSnap = pt;
            }
        }

        if (bestSnap !== -1 && minDist <= SNAP_THRESHOLD) {
            return bestSnap;
        }

        // 2. Fallback to 5-min grid
        return Math.round(rawMinutes / 5) * 5;
    }, [snapPoints]);

    const getMinutesFromX = (x: number) => {
        if (!containerRef.current) return 0;
        const rect = containerRef.current.getBoundingClientRect();
        const relativeX = x - rect.left;
        const width = rect.width;

        const totalMinutes = zoomRange.end - zoomRange.start;
        const rawMinutes = zoomRange.start + (relativeX / width) * totalMinutes;

        return Math.max(0, Math.min(1440, snapTime(rawMinutes)));
    };

    // Handle ESC / Backspace / Delete
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (dragMode) {
                    // Cancel drag: revert
                    setDragMode(null);
                    setAnchor(null);
                    onGuideChange([]);
                    onDraftChange(initialDraft);
                } else if (draft) {
                    // Just deselect
                    onDraftChange(null);
                }
            } else if (e.key === "Backspace" || e.key === "Delete") {
                // Ignore if typing
                const target = e.target as HTMLElement;
                if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
                    return;
                }

                if (dragMode) {
                    // Cancel drag: revert
                    setDragMode(null);
                    setAnchor(null);
                    onGuideChange([]);
                    onDraftChange(initialDraft);
                } else if (draft) {
                    // Remove draft (delete)
                    onDraftChange(null);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [dragMode, draft, initialDraft, onDraftChange, onGuideChange]);

    const findMostActiveApp = (startMin: number, endMin: number): string | undefined => {
        const usageMap = new Map<string, number>();

        autoEvents.forEach(e => {
            const eDate = new Date(e.timestamp);
            const eStart = eDate.getHours() * 60 + eDate.getMinutes();
            const eEnd = eStart + (e.duration / 60);

            // Check overlap
            const overlapStart = Math.max(startMin, eStart);
            const overlapEnd = Math.min(endMin, eEnd);

            if (overlapEnd > overlapStart) {
                const duration = overlapEnd - overlapStart;
                const app = e.data.app || "Unknown";
                usageMap.set(app, (usageMap.get(app) || 0) + duration);
            }
        });

        if (usageMap.size === 0) return undefined;

        let maxApp = undefined;
        let maxDuration = 0;

        for (const [app, duration] of usageMap.entries()) {
            if (duration > maxDuration) {
                maxDuration = duration;
                maxApp = app;
            }
        }
        return maxApp;
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        if (e.button !== 0) return; // Only left click

        e.preventDefault();
        e.stopPropagation();

        const startM = getMinutesFromX(e.clientX);

        setInitialDraft(draft); // Capture initial state

        // Check if clicking on existing draft
        if (draft && startM >= draft.start && startM <= draft.end) {
            // Note: Resize handle clicks are handled by their own onMouseDown (stopPropagation)
            // So if we reach here, it's a move on the body
            setDragMode("move");
            setMoveOffset(startM - draft.start);
            onGuideChange([draft.start, draft.end]);
            return;
        }

        // Start NEW creation
        setDragMode("create");
        setAnchor(startM);
        // Clear previous suggestion
        onGuideChange([startM, startM]);
        setInitialDraft(null); // New creation starts from nothing
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        if (!dragMode) return;
        if (!draft && dragMode !== "create") return; // Should not happen for move/resize

        const mins = getMinutesFromX(e.clientX);
        const snapped = mins; // getMinutesFromX is already snapped

        if (dragMode === "create" && anchor !== null) {
            const s = Math.min(anchor, snapped);
            const e = Math.max(anchor, snapped);
            onDraftChange({ start: s, end: e, suggestedApp: undefined });
            onGuideChange([s, e]);
        }
        else if (dragMode === "move" && draft) {
            const duration = draft.end - draft.start;
            const newStart = snapped - moveOffset;
            const newEnd = newStart + duration;
            if (newStart >= 0 && newEnd <= 1440) {
                onDraftChange({ ...draft, start: newStart, end: newEnd });
                onGuideChange([newStart, newEnd]);
            }
        }
        else if (dragMode === "resize-start" && draft) {
            // Adjust start only. Max is end - 5.
            const newStart = Math.min(snapped, draft.end - 5);
            if (newStart >= 0) {
                onDraftChange({ ...draft, start: newStart });
                onGuideChange([newStart]);
            }
        }
        else if (dragMode === "resize-end" && draft) {
            // Adjust end only. Min is start + 5.
            const newEnd = Math.max(snapped, draft.start + 5);
            if (newEnd <= 1440) {
                onDraftChange({ ...draft, end: newEnd });
                onGuideChange([newEnd]);
            }
        }
    };

    const handleMouseUp = () => {
        if ((dragMode === "create" || dragMode === "resize-start" || dragMode === "resize-end") && draft) {
            // Analyze app suggestion on drop/resize finish
            const app = findMostActiveApp(draft.start, draft.end);
            if (app) {
                onDraftChange({ ...draft, suggestedApp: app });
            }
        }
        setDragMode(null);
        setAnchor(null);
        onGuideChange([]);
    };

    const getStyle = (start: number, end: number) => {
        // Map absolute minutes to % relative to zoom window
        const totalVisible = zoomRange.end - zoomRange.start;

        // Clamp to view? Or allow overflow hidden?
        // Let's allow calculation to go negative/ >100% and let CSS hide it.
        const relativeStart = start - zoomRange.start;
        const relativeW = end - start;

        const left = (relativeStart / totalVisible) * 100;
        const width = (relativeW / totalVisible) * 100;

        return {
            left: `${left}%`,
            width: `${Math.max(width, 0.1)}%` // minimal width visibility
        };
    };

    // Helper for formatting time (HH:MM)
    const ft = (m: number) => {
        const h = Math.floor(m / 60);
        const min = m % 60;
        return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    };

    // Category Colors (Simple hash or specific mapping)
    const getCategoryColor = (cat: string) => {
        // We could use the user's settings if we passed them down, 
        // but for now let's use a consistent hash-based color or simple palette
        let hash = 0;
        for (let i = 0; i < cat.length; i++) {
            hash = cat.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 40%)`; // Darker legible color
    };

    return (
        <div
            ref={containerRef}
            className="relative h-20 w-full bg-secondary/10 rounded-md border-2 border-dashed border-secondary/30 cursor-pointer overflow-hidden group select-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Visual hint */}
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${draft ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                <span className="text-secondary-foreground/20 text-sm font-medium">Drag to add project time</span>
            </div>

            {/* Existing Events */}
            <TooltipProvider>
                {events.map((e, i) => {
                    const d = new Date(e.timestamp);
                    const start = d.getHours() * 60 + d.getMinutes();
                    const end = start + (e.duration / 60);
                    const cat = e.data.app || "Event";

                    // Optimization: visible only?
                    if (end < zoomRange.start || start > zoomRange.end) return null;

                    return (
                        <Tooltip key={e.id || i}>
                            <TooltipTrigger asChild>
                                <div
                                    className="absolute top-1 bottom-1 rounded-sm shadow-sm z-10 hover:brightness-110 flex items-center justify-center overflow-hidden px-1 border border-white/10"
                                    style={{
                                        ...getStyle(start, end),
                                        backgroundColor: getCategoryColor(cat)
                                    }}
                                    onMouseDown={(ev) => ev.stopPropagation()}
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        // Assuming 'onEventClick' is available in the component's scope
                                        // as it would be passed as a prop.
                                        // If this component is 'ManualLane', then 'onEventClick' would be
                                        // part of its props.
                                        // For this snippet, we assume it's available.
                                        if (typeof onEventClick === 'function') onEventClick(e);
                                    }}
                                >
                                    <div className="flex flex-col items-center justify-center w-full overflow-hidden">
                                        <span className="text-xs font-semibold text-white truncate w-full text-center shadow-sm leading-tight">
                                            {e.data.title || e.data.app || "Event"}
                                        </span>
                                        {e.data.description && (
                                            <span className="text-[10px] text-white/90 truncate w-full text-center font-medium leading-tight">
                                                {e.data.description}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs">
                                    <div className="font-bold">{e.data.title || "Untitled"}</div>
                                    <div className="text-muted-foreground">{e.data.description || e.data.app}</div>
                                    <div>{ft(start)} - {ft(end)}</div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </TooltipProvider>

            {/* Draft Selection */}
            {draft && (
                <Tooltip open={true}>
                    <TooltipTrigger asChild>
                        <div
                            className={cn(
                                "absolute top-0 bottom-0 bg-blue-500/30 border-x-2 border-blue-500 z-20 flex items-center justify-center backdrop-blur-[1px]",
                                dragMode === "move" ? "cursor-grabbing" : "cursor-grab"
                            )}
                            style={getStyle(draft.start, draft.end)}
                        >
                            {/* Resize Handles */}
                            <div
                                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-blue-600/0 hover:bg-blue-600/50 transition-colors z-30"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setInitialDraft(draft);
                                    setDragMode("resize-start");
                                    onGuideChange([draft.start]);
                                }}
                            />
                            <div
                                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-blue-600/0 hover:bg-blue-600/50 transition-colors z-30"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setInitialDraft(draft);
                                    setDragMode("resize-end");
                                    onGuideChange([draft.end]);
                                }}
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-blue-600 text-white border-blue-700">
                        <p className="font-mono font-bold">{ft(draft.start)} - {ft(draft.end)}</p>
                        <p className="text-xs text-blue-100">
                            {draft.end - draft.start} min
                            {draft.suggestedApp && ` • Suggested: ${draft.suggestedApp}`}
                        </p>
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}

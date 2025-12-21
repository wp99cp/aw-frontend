"use client";

import { useRef, useState } from "react";
import { Event } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ZoomRange } from "./TimelineView";
import { formatDuration } from "@/lib/event-utils";
import { CategoryClass, classifyEvent } from "@/lib/categories";

interface AutoLaneProps {
    events: Event[];
    zoomRange: ZoomRange;
    onZoomChange: (range: ZoomRange) => void;
    classes?: CategoryClass[];
}

export function AutoLane({ events, zoomRange, onZoomChange, classes = [] }: AutoLaneProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selection, setSelection] = useState<{ start: number, end: number } | null>(null);

    // Helper to position events
    const getStyle = (start: number, duration: number) => {
        const totalVisible = zoomRange.end - zoomRange.start;
        const relativeStart = start - zoomRange.start;

        const left = (relativeStart / totalVisible) * 100;
        const width = ((duration / 60) / totalVisible) * 100;

        return {
            left: `${left}%`,
            width: `${Math.max(width, 0.1)}%`,
        };
    };

    // Get color from category classification, with fallback
    const getColor = (event: Event): string | undefined => {
        const classification = classifyEvent(event, classes);
        if (classification?.color) {
            return classification.color;
        }
        // Fallback colors based on app name
        const app = event.data.app;
        if (!app) return undefined;
        if (app.includes("Code") || app.includes("Terminal")) return "#3b82f6"; // blue-500
        if (app.includes("Chrome") || app.includes("Firefox")) return "#fb923c"; // orange-400
        if (app.includes("Slack") || app.includes("Discord")) return "#a855f7"; // purple-500
        return "#64748b"; // slate-500
    };

    const getMinutesFromX = (x: number, rect: DOMRect) => {
        const percent = Math.max(0, Math.min(1, x / rect.width));
        const totalVisible = zoomRange.end - zoomRange.start;
        return Math.floor(zoomRange.start + (percent * totalVisible));
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mins = getMinutesFromX(e.clientX - rect.left, rect);

        setIsSelecting(true);
        setSelection({ start: mins, end: mins });
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isSelecting || !selection || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mins = getMinutesFromX(e.clientX - rect.left, rect);

        setSelection({ ...selection, end: mins });
    };

    const onMouseUp = () => {
        if (isSelecting && selection) {
            const start = Math.min(selection.start, selection.end);
            const end = Math.max(selection.start, selection.end);

            // Only zoom if selection is significant (> 15 mins?)
            if (end - start > 15) {
                onZoomChange({ start, end });
            }
        }
        setIsSelecting(false);
        setSelection(null);
    };

    return (
        <div
            ref={containerRef}
            className="relative h-16 w-full bg-muted/30 rounded-md overflow-hidden border cursor-crosshair select-none group"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { setIsSelecting(false); setSelection(null); }}
        >
            {/* Visual hint overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <span className="text-muted-foreground/30 text-xs uppercase tracking-widest font-bold">Drag to Zoom</span>
            </div>

            <TooltipProvider>
                {events.map((event, i) => {
                    const date = new Date(event.timestamp);
                    const start = date.getHours() * 60 + date.getMinutes();
                    const duration = event.duration; // seconds

                    // optimize visibility
                    const end = start + (duration / 60);
                    if (end < zoomRange.start || start > zoomRange.end) return null;

                    const style = getStyle(start, duration);
                    if (parseFloat(style.width) <= 0) return null;

                    return (
                        <Tooltip key={event.id || i}>
                            <TooltipTrigger asChild>
                                <div
                                    className="absolute top-0 bottom-0 hover:brightness-110 transition-all opacity-80"
                                    style={{
                                        ...style,
                                        backgroundColor: getColor(event) || '#94a3b8'
                                    }}
                                />
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs">
                                    <div className="font-bold">{event.data.app}</div>
                                    <div>{event.data.title}</div>
                                    <div>{formatDuration(event.duration)}</div>
                                    <div className="text-muted-foreground">{date.toLocaleTimeString()}</div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </TooltipProvider>

            {/* Selection Overlay */}
            {selection && (
                <div
                    className="absolute top-0 bottom-0 bg-blue-400/20 border-x border-blue-400 z-30 pointer-events-none"
                    style={{
                        left: `${((Math.min(selection.start, selection.end) - zoomRange.start) / (zoomRange.end - zoomRange.start)) * 100}%`,
                        width: `${(Math.abs(selection.end - selection.start) / (zoomRange.end - zoomRange.start)) * 100}%`
                    }}
                />
            )}
        </div>
    );
}

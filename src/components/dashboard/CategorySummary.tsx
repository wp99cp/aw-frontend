"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { calculateEffectiveDuration, formatDuration } from "@/lib/event-utils";
import { SunburstNode } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { EventModal } from "@/components/events/EventModal";
import { Event } from "@/lib/types";


function CategoryRow({ node, totalTime, depth = 0, onEventClick }: { node: SunburstNode, totalTime: number, depth?: number, onEventClick: (event: Event) => void }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const duration = calculateEffectiveDuration(node.events);

    // In buildSunburstData, leaf nodes are specific events.
    // For the "Category Summary", we probably only want to show nodes that represent actual categories
    // or at least cap the recursion if it's too deep. 
    // However, showing everything that was in the sunburst is usually expected.
    const hasChildren = node.children && node.children.length > 0;

    // Sort children by duration
    const sortedChildren = [...(node.children || [])].sort((a, b) =>
        calculateEffectiveDuration(b.events) - calculateEffectiveDuration(a.events)
    );

    return (
        <div className="space-y-1">
            <div
                className={cn(
                    "flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 p-1.5 rounded-md transition-colors group",
                    depth > 0 && "ml-4 border-l pl-2"
                )}
                onClick={() => {
                    if (hasChildren) {
                        setIsExpanded(!isExpanded);
                    } else if (node.events && node.events.length > 0) {
                        onEventClick(node.events[0]);
                    }
                }}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            {hasChildren ? (
                                isExpanded ?
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> :
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                                <div className="w-3.5 h-3.5 shrink-0" /> // Spacer
                            )}
                            <span className={cn(
                                "truncate",
                                depth === 0 ? "font-semibold" : "font-medium text-muted-foreground group-hover:text-foreground"
                            )}>
                                {node.name}
                            </span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground tabular-nums ml-2">
                            {formatDuration(duration)}
                        </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all duration-500"
                            style={{
                                width: `${totalTime > 0 ? (duration / totalTime) * 100 : 0}%`,
                                backgroundColor: node.color || 'hsl(var(--primary) / 0.8)'
                            }}
                        />
                    </div>
                </div>
            </div>
            {isExpanded && hasChildren && (
                <div className="mt-1">
                    {sortedChildren.map((child, i) => (
                        <CategoryRow
                            key={`${child.name}-${i}`}
                            node={child}
                            totalTime={totalTime}
                            depth={depth + 1}
                            onEventClick={onEventClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function CategorySummary({ data, timeRange, onActivityLogged }: { data: SunburstNode | null, timeRange: string, onActivityLogged?: () => void }) {
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    if (!data || !data.children || data.children.length === 0) {
        return (
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle>Category Summary</CardTitle>
                    <CardDescription>Activity distribution</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No data available for {timeRange}</p>
                </CardContent>
            </Card>
        );
    }

    // Sort top-level categories by total duration desc
    const sortedCategories = [...data.children].sort((a, b) =>
        calculateEffectiveDuration(b.events) - calculateEffectiveDuration(a.events)
    );

    const totalTime = calculateEffectiveDuration(data.events);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Category Summary</CardTitle>
                        <CardDescription>
                            Activity by category
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold">{formatDuration(totalTime)}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Time</div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <div className="h-full overflow-y-auto p-6 pt-2 space-y-3">
                    {sortedCategories.map((node, i) => (
                        <CategoryRow
                            key={`${node.name}-${i}`}
                            node={node}
                            totalTime={totalTime}
                            onEventClick={(ev) => setSelectedEvent(ev)}
                        />
                    ))}
                </div>
            </CardContent>
            <EventModal
                isOpen={!!selectedEvent}
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onSave={() => {
                    setSelectedEvent(null);
                    if (onActivityLogged) onActivityLogged();
                }}
            />
        </Card>
    );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { Event } from "@/lib/types";

interface CategoryEventsListProps {
    node: any;
    onBack: () => void;
}

export function CategoryEventsList({ node, onBack }: CategoryEventsListProps) {
    if (!node) return null;

    // Flatten events from the node and its children (if any)
    // Actually, our buildSunburstData attaches events to each node for that specific node AND its children (accumulated?)
    // In modify task earlier: "currentNode.events.push(event)" was inside the loop for each segment.
    // So a node ALREADY contains all events for its subtree. Perfect.

    // Sort events by duration (longest first)
    const events: Event[] = node.events || [];
    const sortedEvents = [...events].sort((a, b) => b.duration - a.duration);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="mr-2 px-2">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <CardTitle className="text-lg">{node.name}</CardTitle>
                    <CardDescription>{events.length} activities</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
                {sortedEvents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">No events found</div>
                ) : (
                    <div className="space-y-4">
                        {sortedEvents.map((event, i) => (
                            <div key={i} className="flex flex-col space-y-1 border-b pb-2 last:border-0 last:pb-0">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold truncate w-2/3">{event.data.title || "Untitled"}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {format(new Date(event.timestamp), "HH:mm")}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground truncate w-1/2">{event.data.app}</span>
                                    <span>{(event.duration / 60).toFixed(1)} min</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

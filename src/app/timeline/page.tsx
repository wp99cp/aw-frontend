"use client";

import { useState, useEffect, useMemo, useCallback, useTransition } from "react";
import { format, addDays, subDays, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, Minus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fetchAllEvents } from "@/lib/data";
import { api } from "@/lib/api";
import { Event } from "@/lib/types";
import { TimelineView } from "@/components/timeline/TimelineView";
import { TimelineSkeleton } from "@/components/timeline/TimelineSkeleton";
import { classifyEvent, Settings } from "@/lib/categories";
import { calculateSessions, calculateZoomRange, ZoomRange } from "@/lib/timeline";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CategoryNode {
    name: string;
    fullPath: string;
    children: CategoryNode[];
}

function buildCategoryTree(categories: string[]): CategoryNode[] {
    const root: CategoryNode[] = [];

    categories.forEach(cat => {
        const parts = cat.split(" > ");
        let currentLevel = root;
        let pathSoFar = "";

        parts.forEach((part, idx) => {
            pathSoFar = idx === 0 ? part : `${pathSoFar} > ${part} `;
            let existing = currentLevel.find(n => n.name === part);

            if (!existing) {
                existing = { name: part, fullPath: pathSoFar, children: [] };
                currentLevel.push(existing);
            }
            currentLevel = existing.children;
        });
    });

    return root;
}

function getAllDescendants(node: CategoryNode): string[] {
    const result: string[] = [node.fullPath];
    node.children.forEach(child => {
        result.push(...getAllDescendants(child));
    });
    return result;
}

function getAllPaths(nodes: CategoryNode[]): string[] {
    const result: string[] = [];
    nodes.forEach(node => {
        result.push(...getAllDescendants(node));
    });
    return result;
}

type CheckState = "checked" | "unchecked" | "indeterminate";

function getCheckState(node: CategoryNode, selectedCategories: string[]): CheckState {
    const allDescendants = getAllDescendants(node);
    const selectedCount = allDescendants.filter(d => selectedCategories.includes(d)).length;

    if (selectedCount === 0) return "unchecked";
    if (selectedCount === allDescendants.length) return "checked";
    return "indeterminate";
}

interface CategoryItemProps {
    node: CategoryNode;
    depth: number;
    selectedCategories: string[];
    onToggle: (node: CategoryNode) => void;
}

function CategoryItem({ node, depth, selectedCategories, onToggle }: CategoryItemProps) {
    const state = getCheckState(node, selectedCategories);
    const hasChildren = node.children.length > 0;

    return (
        <>
            <button
                onClick={() => onToggle(node)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left"
                style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
                <div className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                    state === "checked" && "bg-primary border-primary text-primary-foreground",
                    state === "indeterminate" && "bg-primary/50 border-primary text-primary-foreground",
                    state === "unchecked" && "border-muted-foreground/50"
                )}>
                    {state === "checked" && <Check className="h-3 w-3" />}
                    {state === "indeterminate" && <Minus className="h-3 w-3" />}
                </div>
                <span className={cn(
                    depth === 0 && "font-medium",
                    hasChildren && "text-foreground"
                )}>
                    {node.name}
                </span>
            </button>
            {node.children.map(child => (
                <CategoryItem
                    key={child.fullPath}
                    node={child}
                    depth={depth + 1}
                    selectedCategories={selectedCategories}
                    onToggle={onToggle}
                />
            ))}
        </>
    );
}

export default function TimelinePage() {
    const [date, setDate] = useState<Date>(new Date());
    const [loading, setLoading] = useState(true);
    const [autoEvents, setAutoEvents] = useState<Event[]>([]);
    const [manualEvents, setManualEvents] = useState<Event[]>([]);
    const [initialZoomRange, setInitialZoomRange] = useState<ZoomRange>({ start: 0, end: 1440 });

    // Filtering State
    const [settings, setSettings] = useState<Settings | null>(null);
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // Empty = All
    const [deferredCategories, setDeferredCategories] = useState<string[]>([]); // Deferred for expensive filter
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isFiltering, startFilterTransition] = useTransition();
    const [isBucketsExpanded, setIsBucketsExpanded] = useState(false);

    useEffect(() => {
        const loadEventsAndSettings = async () => {
            setLoading(true);
            try {
                // Fetch settings once if not loaded
                let currentSettings = settings;
                if (!currentSettings) {
                    currentSettings = await api.getSettings();
                    setSettings(currentSettings);
                }

                // Fetch for the entire day (00:00 - 23:59:59)
                const start = startOfDay(date);
                const end = endOfDay(date);

                const allEvents = await fetchAllEvents(start, end);

                // Split into auto and manual AND Extract Categories
                const auto: Event[] = [];
                const manual: Event[] = [];
                const foundCategories = new Set<string>();

                allEvents.forEach(e => {
                    // Classify to find category
                    const classification = classifyEvent(e, currentSettings?.classes || []);
                    if (classification) {
                        const categoryString = classification.name.join(" > ");
                        foundCategories.add(categoryString);
                    } else {
                        foundCategories.add("Uncategorized");
                    }

                    if (e.bucketId?.includes("manual")) {
                        manual.push(e);
                    } else if (e.bucketId?.includes("afk") || e.data?.status === "afk") {
                        // Skip AFK events
                    } else {
                        auto.push(e);
                    }
                });

                setAutoEvents(auto);
                setManualEvents(manual);

                // Calculate optimal zoom immediately
                const sessions = calculateSessions(auto, manual);
                const zoom = calculateZoomRange(sessions);
                setInitialZoomRange(zoom);

                // Update available categories 
                const sortedCats = Array.from(foundCategories).sort();
                setAvailableCategories(sortedCats);

            } catch (err) {
                console.error("Failed to load events", err);
            } finally {
                setLoading(false);
            }
        };

        loadEventsAndSettings();
    }, [date]);

    // Refresh handler passed down to components
    const handleRefresh = () => {
        setDate(new Date(date));
    };

    // Build category tree
    const categoryTree = useMemo(() => buildCategoryTree(availableCategories), [availableCategories]);

    // Toggle category with tree logic
    const toggleCategory = useCallback((node: CategoryNode) => {
        const state = getCheckState(node, selectedCategories);
        const allDescendants = getAllDescendants(node);

        let newCategories: string[];
        if (state === "checked") {
            // Uncheck all descendants
            newCategories = selectedCategories.filter(c => !allDescendants.includes(c));
        } else {
            // Check all descendants
            const newSet = new Set(selectedCategories);
            allDescendants.forEach(d => newSet.add(d));
            newCategories = Array.from(newSet);
        }

        setSelectedCategories(newCategories);
        startFilterTransition(() => {
            setDeferredCategories(newCategories);
        });
    }, [selectedCategories]);

    // Clear all categories handler
    const clearCategories = useCallback(() => {
        setSelectedCategories([]);
        startFilterTransition(() => {
            setDeferredCategories([]);
        });
    }, []);

    // Filter Logic - uses deferred categories to avoid blocking UI
    const filteredData = useMemo(() => {
        if (deferredCategories.length === 0) {
            return { auto: autoEvents, manual: manualEvents };
        }

        const filterFn = (e: Event) => {
            const cls = classifyEvent(e, settings?.classes || []);
            const cat = cls ? cls.name.join(" > ") : "Uncategorized";

            // Check for exact match OR if event's category starts with any selected category
            // e.g., if "Work" is selected, "Work > Programming" should also match
            return deferredCategories.some(selected =>
                cat === selected || cat.startsWith(selected + " > ")
            );
        };

        return {
            auto: autoEvents.filter(filterFn),
            manual: manualEvents.filter(filterFn)
        };
    }, [autoEvents, manualEvents, deferredCategories, settings]);

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h1 className="text-3xl font-bold">Timeline</h1>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setDate(subDays(date, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => d && setDate(d)}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>

                    <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>

                    <div className="h-4 w-px bg-border mx-2" />

                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={selectedCategories.length > 0 ? "bg-secondary" : ""}>
                                <Filter className="mr-2 h-4 w-4" />
                                Filter
                                {selectedCategories.length > 0 && (
                                    <span className="ml-1 rounded-full bg-primary text-primary-foreground w-5 h-5 flex items-center justify-center text-[10px]">
                                        {selectedCategories.length}
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[360px] p-0" align="end">
                            <div className="p-2 border-b">
                                <span className="text-sm font-medium">Filter by Category</span>
                            </div>
                            <ScrollArea className="h-[300px]">
                                <div className="p-2 space-y-0.5">
                                    <button
                                        onClick={clearCategories}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left font-medium"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                                            selectedCategories.length === 0
                                                ? "bg-primary border-primary text-primary-foreground"
                                                : "border-muted-foreground/50"
                                        )}>
                                            {selectedCategories.length === 0 && <Check className="h-3 w-3" />}
                                        </div>
                                        <span>Show All</span>
                                    </button>

                                    <div className="h-px bg-border my-2" />

                                    {categoryTree.map(node => (
                                        <CategoryItem
                                            key={node.fullPath}
                                            node={node}
                                            depth={0}
                                            selectedCategories={selectedCategories}
                                            onToggle={toggleCategory}
                                        />
                                    ))}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>

                    <Button variant="outline" onClick={handleRefresh} disabled={loading}>
                        Refresh
                    </Button>
                </div>
            </div>

            {loading || isFiltering ? (
                <TimelineSkeleton />
            ) : (
                <TimelineView
                    date={date}
                    autoEvents={filteredData.auto}
                    manualEvents={filteredData.manual}
                    onEventCreated={handleRefresh}
                    initialZoomRange={initialZoomRange}
                    classes={settings?.classes}
                    isExpanded={isBucketsExpanded}
                    onExpandedChange={setIsBucketsExpanded}
                />
            )}
        </div>
    );
}

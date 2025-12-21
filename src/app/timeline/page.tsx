"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays, subDays, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fetchAllEvents } from "@/lib/data";
import { api } from "@/lib/api";
import { Event } from "@/lib/types";
import { TimelineView } from "@/components/timeline/TimelineView";
import { classifyEvent, Settings } from "@/lib/categories";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export default function TimelinePage() {
    const [date, setDate] = useState<Date>(new Date());
    const [loading, setLoading] = useState(true);
    const [autoEvents, setAutoEvents] = useState<Event[]>([]);
    const [manualEvents, setManualEvents] = useState<Event[]>([]);

    // Filtering State
    const [settings, setSettings] = useState<Settings | null>(null);
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // Empty = All
    const [isFilterOpen, setIsFilterOpen] = useState(false);

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
                        const categoryString = classification.join(" > ");
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

    // Filter Logic
    const filteredData = useMemo(() => {
        if (selectedCategories.length === 0) {
            return { auto: autoEvents, manual: manualEvents };
        }

        const filterFn = (e: Event) => {
            const cls = classifyEvent(e, settings?.classes || []);
            const cat = cls ? cls.join(" > ") : "Uncategorized";
            return selectedCategories.includes(cat);
        };

        return {
            auto: autoEvents.filter(filterFn),
            manual: manualEvents.filter(filterFn)
        };
    }, [autoEvents, manualEvents, selectedCategories, settings]);

    const toggleCategory = (cat: string) => {
        if (selectedCategories.includes(cat)) {
            setSelectedCategories(prev => prev.filter(c => c !== cat));
        } else {
            setSelectedCategories(prev => [...prev, cat]);
        }
    };

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
                        <PopoverContent className="w-[300px] p-0" align="end">
                            <Command>
                                <CommandInput placeholder="Search categories..." />
                                <CommandList>
                                    <CommandEmpty>No category found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem onSelect={() => setSelectedCategories([])}>
                                            <div className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                selectedCategories.length === 0 ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                            )}>
                                                <Filter className="h-3 w-3" />
                                            </div>
                                            <span>Show All</span>
                                        </CommandItem>
                                        {availableCategories.map(cat => (
                                            <CommandItem key={cat} onSelect={() => toggleCategory(cat)}>
                                                <div className={cn(
                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                    selectedCategories.includes(cat) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                )}>
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="24"
                                                        height="24"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        className="h-3 w-3"
                                                    >
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                </div>
                                                <span>{cat}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    <Button variant="outline" onClick={handleRefresh} disabled={loading}>
                        Refresh
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex h-[400px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <TimelineView
                    date={date}
                    autoEvents={filteredData.auto}
                    manualEvents={filteredData.manual}
                    onEventCreated={handleRefresh}
                />
            )}
        </div>
    );
}

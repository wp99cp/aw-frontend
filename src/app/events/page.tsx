"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
// import { fetchAllEvents } from "@/lib/data"; // Removed
import { Event } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { PlusCircle, RefreshCw, Trash2, Search, Filter, Edit, Tag, CheckSquare, X, Check, ChevronsUpDown } from "lucide-react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, getHumanReadableBucketName } from "@/lib/utils";
import { CategoryClass } from "@/lib/categories";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEvents } from "@/context/EventsContext";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Settings, classifyEvent } from "@/lib/categories";
import { Bucket } from "@/lib/types";
import { EventModal } from "@/components/events/EventModal";

import { getEventPreview } from "@/lib/event-utils";

export function getHumanReadableType(type: string): string {
    switch (type) {
        case "afkstatus": return "AFK Status";
        case "app.editor.activity": return "Editor Activity";
        case "currentwindow": return "Window";
        case "web.tab.current": return "Web Tab";
        case "manual": return "Manual Entry";
        default: return type;
    }
}

export default function EventsPage() {
    // Data State
    const { events, loading, date, setDate, fetchEvents, setEvents } = useEvents();

    // UI/Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());

    // New Filters State
    const [buckets, setBuckets] = useState<Record<string, Bucket>>({});
    const [settings, setSettings] = useState<Settings | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedBucket, setSelectedBucket] = useState<string>("all");

    const [selectedType, setSelectedType] = useState<string>("all");

    // Event Detail View State
    const [viewEvent, setViewEvent] = useState<Event | null>(null);

    // Load initial data for filters
    useEffect(() => {
        api.getBuckets().then(setBuckets).catch(console.error);
        api.getSettings().then(setSettings).catch(console.error);
    }, []);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;

    // Bulk Category State
    const [isBulkCatOpen, setIsBulkCatOpen] = useState(false);
    const [bulkCatForm, setBulkCatForm] = useState({ category: "", regex: "" });
    const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);

    // Extract all unique category paths from settings
    const allCategoryPaths = useMemo(() => {
        if (!settings?.classes) return [];
        const paths = new Set<string>();

        // Helper to safely convert a name segment to string
        const toStringSegment = (segment: unknown): string => {
            if (typeof segment === 'string') return segment;
            if (segment && typeof segment === 'object' && 'primary' in segment) {
                return String((segment as { primary: unknown }).primary);
            }
            return String(segment);
        };

        const traverse = (classes: CategoryClass[]) => {
            classes.forEach(c => {
                if (Array.isArray(c.name)) {
                    const stringNames = c.name.map(toStringSegment);
                    const fullPath = stringNames.join(" > ");
                    paths.add(fullPath);
                    // Also add parent paths
                    for (let i = 1; i < stringNames.length; i++) {
                        paths.add(stringNames.slice(0, i).join(" > "));
                    }
                }
            });
        };
        traverse(settings.classes);
        return Array.from(paths).sort();
    }, [settings]);



    // Delete Confirmation State
    const [deleteConfirmState, setDeleteConfirmState] = useState<{
        isOpen: boolean;
        type: 'single' | 'bulk';
        event?: Event;
    }>({ isOpen: false, type: 'single' });

    // Computed Events
    const filteredEvents = useMemo(() => {
        // Base filter
        let res = events;

        // 1. Search
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            res = res.filter(e =>
                (e.data.title && e.data.title.toLowerCase().includes(lower)) ||
                (e.data.app && e.data.app.toLowerCase().includes(lower)) ||
                (e.data.url && e.data.url.toLowerCase().includes(lower)) ||
                (e.data.tags && e.data.tags.some(t => t.toLowerCase().includes(lower)))
            );
        }

        // 2. Category Filter
        if (selectedCategory !== "all" && settings) {
            res = res.filter(e => {
                const cat = classifyEvent(e, settings.classes);
                const catStr = cat ? cat.join(" > ") : "Uncategorized";
                return catStr === selectedCategory;
            });
        }

        // 3. Bucket Filter
        if (selectedBucket !== "all") {
            res = res.filter(e => e.bucketId === selectedBucket);
        }

        // 4. Type Filter
        if (selectedType !== "all") {
            res = res.filter(e => {
                const b = buckets[e.bucketId || ""];
                return b && b.type === selectedType;
            });
        }

        return res;
    }, [events, searchQuery, selectedCategory, selectedBucket, selectedType, settings, buckets]);

    // Derived Options for Filters
    const uniqueCategories = useMemo(() => {
        if (!settings) return [];
        const cats = new Set<string>();
        events.forEach(e => {
            const c = classifyEvent(e, settings.classes);
            cats.add(c ? c.join(" > ") : "Uncategorized");
        });
        return Array.from(cats).sort();
    }, [events, settings]);

    const uniqueBuckets = useMemo(() => {
        // Only show buckets that actually have events in the list? Or all? 
        // Showing all available might explain why "0" events if selected.
        // But listing only relevant ones works better for "drilling down".
        // Let's list buckets present in current events list (before filter? or raw?)
        // Usually logical to filter based on available dataset. 
        const ids = new Set(events.map(e => e.bucketId).filter(Boolean));
        return Array.from(ids).map(id => ({
            id: id!,
            name: getHumanReadableBucketName(id!, buckets[id!]?.data?.label as string)
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [events, buckets]);

    const uniqueTypes = useMemo(() => {
        const types = new Set<string>();
        events.forEach(e => {
            if (e.bucketId && buckets[e.bucketId]) {
                types.add(buckets[e.bucketId].type);
            }
        });
        return Array.from(types).sort();
    }, [events, buckets]);

    const totalPages = Math.ceil(filteredEvents.length / pageSize);
    const paginatedEvents = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredEvents.slice(start, start + pageSize);
    }, [filteredEvents, currentPage]);

    // Reset pagination when filters change
    useEffect(() => {
        setTimeout(() => {
            setCurrentPage(1);
        }, 0);
    }, [searchQuery, date]);

    // Ensure we don't stay on a non-existent page if data shrinks
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setTimeout(() => {
                setCurrentPage(totalPages);
            }, 0);
        }
    }, [totalPages, currentPage]);

    // Handlers
    const toggleSelect = (id: number) => {
        const next = new Set(selectedEventIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedEventIds(next);
    };

    const toggleSelectAll = () => {
        // Toggle all on current page or all filtered? usually current page is safer/easier for user
        // But user might expect "Select All" to mean ALL filtered.
        // Let's stick to visible/filtered for now.
        // If we select ALL filtered, bulk delete might be huge.
        // Let's toggle only visible for now to be safe, or ALL filtered?
        // Code pattern usually: select all filtered.
        if (selectedEventIds.size === filteredEvents.length) {
            setSelectedEventIds(new Set());
        } else {
            // Only select valid IDs
            const ids = filteredEvents.map(e => e.id).filter((id): id is number => id !== undefined);
            setSelectedEventIds(new Set(ids));
        }
    };

    const handleDelete = (event: Event) => {
        if (!event.bucketId || event.id === undefined) return;
        setDeleteConfirmState({ isOpen: true, type: 'single', event });
    };

    const confirmDelete = async () => {
        const { type, event } = deleteConfirmState;

        if (type === 'single' && event) {
            if (!event.bucketId || event.id === undefined) return;
            try {
                await api.deleteEvent(event.bucketId, event.id);
                setEvents(prev => prev.filter(e => !(e.id === event!.id && e.bucketId === event!.bucketId)));
                toast.success("Event deleted");
                if (paginatedEvents.length === 1 && currentPage > 1) {
                    setCurrentPage(prev => prev - 1);
                }
            } catch (e) {
                toast.error("Failed to delete event");
                console.error(e);
            }
        } else if (type === 'bulk') {
            let successCount = 0;
            const eventsToDelete = filteredEvents.filter(e => e.id !== undefined && selectedEventIds.has(e.id));

            for (const ev of eventsToDelete) {
                if (ev.bucketId && ev.id !== undefined) {
                    try {
                        await api.deleteEvent(ev.bucketId, ev.id);
                        successCount++;
                    } catch (e) { console.error(e); }
                }
            }
            toast.success(`Deleted ${successCount} events`);
            fetchEvents();
            setSelectedEventIds(new Set());
        }

        setDeleteConfirmState({ isOpen: false, type: 'single' });
    };

    const handleBulkDelete = () => {
        if (selectedEventIds.size === 0) return;
        setDeleteConfirmState({ isOpen: true, type: 'bulk' });
    };

    // Bulk Category Logic
    const openBulkCategory = () => {
        const firstId = Array.from(selectedEventIds)[0];
        const firstEvent = events.find(e => e.id === firstId);
        setBulkCatForm({
            category: "",
            regex: firstEvent?.data.app || firstEvent?.data.url || ""
        });
        setIsBulkCatOpen(true);
    };

    const saveBulkCategory = async () => {
        if (!bulkCatForm.category || !bulkCatForm.regex) {
            toast.error("Please fill all fields");
            return;
        }

        try {
            const path = bulkCatForm.category.split(">").map(s => s.trim());
            await api.createCategoryRule(path, bulkCatForm.regex);
            setIsBulkCatOpen(false);
            toast.success(`Category rule created for ${path.join(" > ")}`);
        } catch (e) {
            toast.error("Failed to create rule");
            console.error(e);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Events</h1>
                    <p className="text-muted-foreground">Manage and organize your activity logs.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => fetchEvents()}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button asChild>
                        <Link href="/events/new">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Log Activity
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex flex-col gap-2 w-full flex-1">
                    <div className="flex items-center gap-2 w-full flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Filters */}
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {uniqueCategories.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedBucket} onValueChange={setSelectedBucket}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Bucket" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Buckets</SelectItem>
                                {uniqueBuckets.map(b => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger className="w-[110px]">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {uniqueTypes.map(t => (
                                    <SelectItem key={t} value={t}>{getHumanReadableType(t)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Date Nav */}
                        <div className="flex items-center border rounded-md bg-background">
                            <Button variant="ghost" size="icon" onClick={() => setDate(new Date(date.setDate(date.getDate() - 1)))}>
                                &lt;
                            </Button>
                            <span className="px-2 text-sm font-medium min-w-[90px] text-center">
                                {format(date, "yyyy-MM-dd")}
                            </span>
                            <Button variant="ghost" size="icon" onClick={() => setDate(new Date(date.setDate(date.getDate() + 1)))}>
                                &gt;
                            </Button>
                        </div>
                    </div>
                </div>


            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="border-b px-4 py-3 flex items-center bg-muted/40 justify-between">
                        <div className="flex items-center min-h-[32px]">
                            <Checkbox
                                checked={filteredEvents.length > 0 && selectedEventIds.size === filteredEvents.length}
                                onChange={toggleSelectAll}
                                className="mr-3"
                            />
                            {selectedEventIds.size > 0 ? (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                                    <span className="text-sm text-muted-foreground">
                                        {selectedEventIds.size} selected
                                    </span>
                                    <Button variant="secondary" size="sm" onClick={openBulkCategory} className="h-8">
                                        <Tag className="mr-2 h-3.5 w-3.5" />
                                        Categorize
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="h-8">
                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                        Delete
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedEventIds(new Set())} className="h-8 w-8">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <span className="text-sm font-medium text-muted-foreground">
                                    {filteredEvents.length} Events found
                                </span>
                            )}
                        </div>

                        {/* Pagination Controls Top (Optional, but good for quick nav) */}
                        {totalPages > 1 && (
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                <span>Page {currentPage} of {totalPages}</span>
                                <div className="flex border rounded-md bg-background">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-none rounded-l-md"
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage(p => p - 1)}
                                    >
                                        <span className="sr-only">Previous</span>
                                        &lt;
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-none rounded-r-md"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setCurrentPage(p => p + 1)}
                                    >
                                        <span className="sr-only">Next</span>
                                        &gt;
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-muted-foreground">Loading...</div>
                    ) : paginatedEvents.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">No events found matching your criteria.</div>
                    ) : (
                        <div className="divide-y relative">
                            {paginatedEvents.map((event) => {
                                const isSelected = event.id !== undefined && selectedEventIds.has(event.id);
                                return (
                                    <div
                                        key={`${event.bucketId}-${event.id}`}
                                        className={`flex items-center px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer ${isSelected ? 'bg-muted/30' : ''}`}
                                        onClick={() => setViewEvent(event)}
                                    >
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={isSelected}
                                                onChange={() => event.id !== undefined && toggleSelect(event.id)}
                                                className="mr-3"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-2 text-sm items-center">
                                            {/* Time */}
                                            <div className="md:col-span-1 font-mono text-xs text-muted-foreground">
                                                {format(new Date(event.timestamp), "HH:mm")}
                                            </div>

                                            {/* Main Info */}
                                            {(() => {
                                                const preview = getEventPreview(event);
                                                return (
                                                    <div className="md:col-span-6 flex flex-col">
                                                        <span className="font-medium truncate" title={preview.primary}>
                                                            {preview.primary}
                                                        </span>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            {preview.secondary ? (
                                                                <span className="truncate">{preview.secondary}</span>
                                                            ) : (
                                                                <span>{event.data.app}</span>
                                                            )}
                                                            {event.data.tags && event.data.tags.length > 0 && (
                                                                <div className="flex gap-1">
                                                                    {event.data.tags.map(t => (
                                                                        <span key={t} className="px-1.5 py-0.5 bg-secondary rounded-sm text-[10px]">{t}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Duration & Actions */}
                                            <div className="md:col-span-5 flex items-center justify-end gap-3 text-muted-foreground">
                                                {/* Category Chips */}
                                                {(() => {
                                                    const category = settings ? classifyEvent(event, settings.classes) : null;
                                                    if (!category) return null;
                                                    const categoryStr = category.join(" > ");
                                                    return (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedCategory(categoryStr);
                                                            }}
                                                            className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-[10px] font-medium transition-colors truncate max-w-[150px]"
                                                            title={categoryStr}
                                                        >
                                                            {category[category.length - 1]}
                                                        </button>
                                                    );
                                                })()}
                                                <span className="font-mono">{(event.duration).toFixed(0)}s</span>
                                                <div className="flex items-center border-l pl-3 ml-2 gap-1 opactiy-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                        <Link href={`/events/${event.bucketId}/${event.id}/edit`}>
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Link>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(event)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                    }

                    {/* Pagination Controls Bottom */}
                    {
                        !loading && totalPages > 1 && (
                            <div className="border-t px-4 py-3 flex items-center justify-between bg-muted/10">
                                <div className="text-xs text-muted-foreground">
                                    Showing {Math.min(filteredEvents.length, (currentPage - 1) * pageSize + 1)} to {Math.min(filteredEvents.length, currentPage * pageSize)} of {filteredEvents.length} results
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage(p => p - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setCurrentPage(p => p + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )
                    }
                </CardContent >
            </Card >


            {/* Bulk Category Dialog */}
            < Dialog open={isBulkCatOpen} onOpenChange={setIsBulkCatOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Category Rule</DialogTitle>
                        <DialogDescription>
                            Create a new regex rule for the selected events.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Category Path (e.g. Work &gt; Coding)</Label>
                            <Popover open={categoryComboboxOpen} onOpenChange={setCategoryComboboxOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={categoryComboboxOpen}
                                        className={cn(
                                            "w-full justify-between",
                                            !bulkCatForm.category && "text-muted-foreground"
                                        )}
                                    >
                                        {bulkCatForm.category || "Select or type category..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0">
                                    <Command>
                                        <CommandInput
                                            placeholder="Search or type new category..."
                                            value={bulkCatForm.category}
                                            onValueChange={(value) => setBulkCatForm({ ...bulkCatForm, category: value })}
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                <div className="py-2 px-3 text-sm">
                                                    Press Enter to use: <span className="font-mono">{bulkCatForm.category}</span>
                                                </div>
                                            </CommandEmpty>
                                            <CommandGroup heading="Existing Categories">
                                                {allCategoryPaths.map((cat) => (
                                                    <CommandItem
                                                        key={cat}
                                                        value={cat}
                                                        onSelect={() => {
                                                            setBulkCatForm({ ...bulkCatForm, category: cat });
                                                            setCategoryComboboxOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                bulkCatForm.category === cat ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {cat}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Regex Match</Label>
                            <Input
                                placeholder="Regex pattern"
                                value={bulkCatForm.regex}
                                onChange={e => setBulkCatForm({ ...bulkCatForm, regex: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Pattern matches against: App Title URL
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsBulkCatOpen(false)}>Cancel</Button>
                        <Button onClick={saveBulkCategory}>Create Rule</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            <EventModal
                isOpen={!!viewEvent}
                event={viewEvent}
                onClose={() => setViewEvent(null)}
                onSave={() => {
                    // Refresh logic is inside EditEventForm, but we might want to close modal or update local state
                    // The onSave in EditEventForm calls fetchEvents() already.
                    // We just need to close the modal.
                    setViewEvent(null);
                }}
            />

            <AlertDialog open={deleteConfirmState.isOpen} onOpenChange={(open) => !open && setDeleteConfirmState(prev => ({ ...prev, isOpen: false }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteConfirmState.type === 'single'
                                ? "This action cannot be undone. This will permanently delete the selected event."
                                : `This action cannot be undone. This will permanently delete ${selectedEventIds.size} events.`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}

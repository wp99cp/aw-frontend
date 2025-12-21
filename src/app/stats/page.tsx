"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fetchAllEvents } from "@/lib/data";
import { classifyEvent, CategoryClass } from "@/lib/categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    addMonths,
    subMonths,
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    addWeeks,
    subWeeks,
    addDays,
    subDays,
    eachHourOfInterval,
    getHours,
    isSameDay
} from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCw, Download } from "lucide-react";

type ViewMode = "day" | "week" | "month";

interface TimeSlot {
    label: string;
    key: string; // "yyyy-MM-dd" or "HH"
    date?: Date;
}

interface CategoryReport {
    name: string;
    totalDuration: number;
    slotStats: Map<string, number>; // key -> seconds
}

export default function StatsPage() {
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>("week");
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [report, setReport] = useState<CategoryReport[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let start: Date, end: Date;
            let slots: TimeSlot[] = [];

            if (viewMode === "day") {
                start = startOfDay(currentDate);
                end = endOfDay(currentDate);
                const hours = eachHourOfInterval({ start, end });
                slots = hours.map(h => ({
                    label: format(h, "HH:00"),
                    key: h.getHours().toString(),
                    date: h
                }));
            } else if (viewMode === "week") {
                start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
                end = endOfWeek(currentDate, { weekStartsOn: 1 });
                const days = eachDayOfInterval({ start, end });
                slots = days.map(d => ({
                    label: format(d, "EEE"), // Mon, Tue...
                    key: format(d, "yyyy-MM-dd"),
                    date: d
                }));
            } else {
                // Month
                start = startOfMonth(currentDate);
                end = endOfMonth(currentDate);
                const days = eachDayOfInterval({ start, end });
                slots = days.map(d => ({
                    label: format(d, "d"),
                    key: format(d, "yyyy-MM-dd"),
                    date: d
                }));
            }

            setTimeSlots(slots);

            const allEvents = await fetchAllEvents(start, end);
            const settings = await api.getSettings();
            const classes = settings?.classes || [];

            // Filter out AFK events
            const filteredEvents = allEvents.filter(ev => !ev.bucketId?.startsWith("aw-watcher-afk"));

            // Helper to get top level category name
            const getTopLevel = (path: string[] | null) => {
                if (!path || path.length === 0) return "Uncategorized";
                return path[0];
            };

            // Helper to get slot key for an event
            const getSlotKey = (timestamp: Date) => {
                if (viewMode === "day") {
                    return timestamp.getHours().toString();
                } else {
                    return format(timestamp, "yyyy-MM-dd");
                }
            };

            // Group events by category and slot, storing intervals
            type Interval = { start: number; end: number };
            const categorySlotIntervals = new Map<string, Map<string, Interval[]>>();

            for (const ev of filteredEvents) {
                const path = classifyEvent(ev, classes);
                const categoryName = getTopLevel(path);
                const evStart = new Date(ev.timestamp).getTime();
                const evEnd = evStart + ev.duration * 1000;

                if (!categorySlotIntervals.has(categoryName)) {
                    categorySlotIntervals.set(categoryName, new Map());
                }
                const slotMap = categorySlotIntervals.get(categoryName)!;

                // An event can span multiple slots, but for simplicity we assign to start slot
                const slotKey = getSlotKey(new Date(ev.timestamp));

                if (!slotMap.has(slotKey)) {
                    slotMap.set(slotKey, []);
                }
                slotMap.get(slotKey)!.push({ start: evStart, end: evEnd });
            }

            // Merge intervals with 5-minute gap tolerance
            const GAP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

            const mergeIntervals = (intervals: Interval[]): Interval[] => {
                if (intervals.length === 0) return [];
                // Sort by start time
                intervals.sort((a, b) => a.start - b.start);
                const merged: Interval[] = [{ ...intervals[0] }];

                for (let i = 1; i < intervals.length; i++) {
                    const last = merged[merged.length - 1];
                    const current = intervals[i];

                    // If current starts within gap tolerance of last's end, merge
                    if (current.start <= last.end + GAP_TOLERANCE_MS) {
                        last.end = Math.max(last.end, current.end);
                    } else {
                        merged.push({ ...current });
                    }
                }
                return merged;
            };

            // Calculate durations from merged intervals
            const categoryMap = new Map<string, CategoryReport>();

            for (const [categoryName, slotMap] of categorySlotIntervals) {
                const catReport: CategoryReport = {
                    name: categoryName,
                    totalDuration: 0,
                    slotStats: new Map()
                };

                for (const [slotKey, intervals] of slotMap) {
                    const merged = mergeIntervals(intervals);
                    const slotDuration = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / 1000; // seconds
                    catReport.slotStats.set(slotKey, slotDuration);
                    catReport.totalDuration += slotDuration;
                }

                categoryMap.set(categoryName, catReport);
            }

            // Convert to array and sort by total duration, keeping Uncategorized at the bottom
            const result = Array.from(categoryMap.values()).sort((a, b) => {
                if (a.name === "Uncategorized") return 1;
                if (b.name === "Uncategorized") return -1;
                return b.totalDuration - a.totalDuration;
            });
            setReport(result);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentDate, viewMode]);

    const handlePrevious = () => {
        if (viewMode === "day") setCurrentDate(d => subDays(d, 1));
        else if (viewMode === "week") setCurrentDate(d => subWeeks(d, 1));
        else setCurrentDate(d => subMonths(d, 1));
    };

    const handleNext = () => {
        if (viewMode === "day") setCurrentDate(d => addDays(d, 1));
        else if (viewMode === "week") setCurrentDate(d => addWeeks(d, 1));
        else setCurrentDate(d => addMonths(d, 1));
    };

    const handleViewModeChange = (val: ViewMode) => {
        setViewMode(val);
        setCurrentDate(new Date()); // Reset to today when switching modes
    };

    const formatDuration = (seconds: number) => {
        if (seconds === 0) return "-";
        const hours = seconds / 3600;
        return hours.toFixed(1);
    };

    const getTitle = () => {
        if (viewMode === "day") return format(currentDate, "MMMM d, yyyy");
        if (viewMode === "week") {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
        }
        return format(currentDate, "MMMM yyyy");
    };

    const downloadCSV = () => {
        // Headers: Category, Total, [Slot 1, Slot 2, ...]
        const headers = ["Category", "Total (h)", ...timeSlots.map(s => s.date && viewMode !== "day" ? format(s.date, "yyyy-MM-dd") : s.label)];

        // Rows
        const rows = report.map(cat => {
            const row = [
                `"${cat.name}"`, // Quote name to handle commas
                (cat.totalDuration / 3600).toFixed(2),
                ...timeSlots.map(s => {
                    const val = cat.slotStats.get(s.key) || 0;
                    return (val / 3600).toFixed(2);
                })
            ];
            return row.join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ActivityWatch_Report_${viewMode}_${format(currentDate, "yyyy-MM-dd")}.csv`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
                <div className="flex items-center space-x-2 flex-wrap gap-y-2 justify-center">
                    <Select value={viewMode} onValueChange={(v) => handleViewModeChange(v as ViewMode)}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day">Today</SelectItem>
                            <SelectItem value="week">This Week</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center space-x-1 border rounded-md">
                        <Button variant="ghost" size="icon" onClick={handlePrevious} className="h-8 w-8">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="font-semibold min-w-[180px] text-center text-sm px-2">
                            {getTitle()}
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <Button variant="outline" size="icon" onClick={downloadCSV} className="ml-2" title="Download CSV">
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={fetchData} className="ml-2">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Time Distribution</CardTitle>
                    <CardDescription>
                        {viewMode === "day" && "Hourly breakdown of activity."}
                        {viewMode === "week" && "Daily breakdown of activity for the week."}
                        {viewMode === "month" && "Daily breakdown of activity for the month."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {loading ? (
                        <div className="p-8 text-center">Loading report...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px] sticky left-0 bg-background z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Category</TableHead>
                                    <TableHead className="text-right font-bold bg-muted/20">Total</TableHead>
                                    {timeSlots.map(slot => (
                                        <TableHead key={slot.key} className="text-center min-w-[40px] px-1">
                                            <div className="text-xs whitespace-nowrap">{slot.label}</div>
                                            {viewMode === "month" && slot.date && (
                                                <div className="text-[10px] text-muted-foreground">{format(slot.date, "EE")}</div>
                                            )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.map((cat) => {
                                    const isUncategorized = cat.name === "Uncategorized";
                                    return (
                                        <TableRow key={cat.name} className={isUncategorized ? "text-muted-foreground" : ""}>
                                            <TableCell className={`font-medium sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isUncategorized ? "bg-muted/30" : "bg-background"}`}>{cat.name}</TableCell>
                                            <TableCell className={`text-right font-bold ${isUncategorized ? "bg-muted/30" : "bg-muted/20"}`}>
                                                {formatDuration(cat.totalDuration)}
                                            </TableCell>
                                            {timeSlots.map(slot => {
                                                const val = cat.slotStats.get(slot.key) || 0;
                                                return (
                                                    <TableCell key={slot.key} className={`text-center px-1 ${isUncategorized ? "bg-muted/20" : (val > 0 ? 'bg-primary/5' : '')}`}>
                                                        {formatDuration(val)}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    );
                                })}
                                {report.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={timeSlots.length + 2} className="text-center py-8 text-muted-foreground">
                                            No activity data found for this period.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

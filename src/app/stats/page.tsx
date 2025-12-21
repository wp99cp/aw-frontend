"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fetchAllEvents } from "@/lib/data";
import { classifyEvent, CategoryClass } from "@/lib/categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays, eachHourOfInterval, isSameDay, startOfYear, endOfYear, eachMonthOfInterval, addYears, subYears } from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCw, Download, ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ViewMode = "day" | "week" | "month" | "year";

interface TimeSlot {
    label: string;
    key: string; // "yyyy-MM-dd" or "HH"
    date?: Date;
}

interface CategoryReport {
    name: string;
    fullName: string;
    totalDuration: number;
    slotStats: Map<string, number>; // key -> seconds
    children: CategoryReport[];
    depth: number;
}

function ReportRow({
    cat,
    timeSlots,
    viewMode,
    formatDuration
}: {
    cat: CategoryReport,
    timeSlots: TimeSlot[],
    viewMode: ViewMode,
    formatDuration: (s: number) => string
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = cat.children.length > 0;
    const isUncategorized = cat.name === "Uncategorized";

    return (
        <>
            <TableRow className={cn(
                isUncategorized ? "text-muted-foreground" : "",
                hasChildren && "cursor-pointer hover:bg-muted/50 transition-colors"
            )} onClick={() => hasChildren && setIsExpanded(!isExpanded)}>
                <TableCell className={cn(
                    "font-medium sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] py-2",
                    isUncategorized ? "bg-muted/30" : "bg-background"
                )}>
                    <div className="flex items-center gap-1" style={{ paddingLeft: `${cat.depth * 1.25}rem` }}>
                        {hasChildren ? (
                            isExpanded ?
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> :
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                            <div className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{cat.name}</span>
                    </div>
                </TableCell>
                <TableCell className={cn(
                    "text-right font-bold py-2 px-4",
                    isUncategorized ? "bg-muted/30" : "bg-muted/20"
                )}>
                    {formatDuration(cat.totalDuration)}
                </TableCell>
                {timeSlots.map(slot => {
                    const val = cat.slotStats.get(slot.key) || 0;
                    return (
                        <TableCell key={slot.key} className={cn(
                            "text-center px-1 py-2",
                            isUncategorized ? "bg-muted/20" : (val > 0 ? 'bg-primary/5' : '')
                        )}>
                            {formatDuration(val)}
                        </TableCell>
                    );
                })}
            </TableRow>
            {isExpanded && cat.children.map((child) => (
                <ReportRow
                    key={child.fullName}
                    cat={child}
                    timeSlots={timeSlots}
                    viewMode={viewMode}
                    formatDuration={formatDuration}
                />
            ))}
        </>
    );
}

export default function StatsPage() {
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>("week");
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [report, setReport] = useState<CategoryReport[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [includeAuto, setIncludeAuto] = useState(false);

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
            } else if (viewMode === "month") {
                // Month
                start = startOfMonth(currentDate);
                end = endOfMonth(currentDate);
                const days = eachDayOfInterval({ start, end });
                slots = days.map(d => ({
                    label: format(d, "d"),
                    key: format(d, "yyyy-MM-dd"),
                    date: d
                }));
            } else {
                // Year
                start = startOfYear(currentDate);
                end = endOfYear(currentDate);
                const months = eachMonthOfInterval({ start, end });
                slots = months.map(m => ({
                    label: format(m, "MMM"),
                    key: format(m, "yyyy-MM"),
                    date: m
                }));
            }

            setTimeSlots(slots);

            const allEvents = await fetchAllEvents(start, end);
            const settings = await api.getSettings();
            const classes = settings?.classes || [];

            // Filter events
            const filteredEvents = allEvents.filter(ev => {
                // Always filter out AFK events
                if (ev.bucketId?.startsWith("aw-watcher-afk")) {
                    return false;
                }
                // When includeAuto is false, only show manual events
                if (!includeAuto) {
                    return ev.bucketId === "aw-watcher-manual-nextjs";
                }
                return true;
            });

            // Internal tree structure for processing
            type Interval = { start: number; end: number };
            interface ProcessNode {
                name: string;
                fullName: string;
                children: Map<string, ProcessNode>;
                slotIntervals: Map<string, Interval[]>;
                depth: number;
            }

            const rootNode: ProcessNode = {
                name: "root",
                fullName: "root",
                children: new Map(),
                slotIntervals: new Map(),
                depth: -1
            };

            const getSlotKey = (timestamp: Date) => {
                if (viewMode === "day") {
                    return timestamp.getHours().toString();
                } else if (viewMode === "year") {
                    return format(timestamp, "yyyy-MM");
                } else {
                    return format(timestamp, "yyyy-MM-dd");
                }
            };

            // Process each event and add it to every node in its category path
            for (const ev of filteredEvents) {
                const result = classifyEvent(ev, classes);
                const path = result?.name || ["Uncategorized"];
                const evStart = new Date(ev.timestamp).getTime();
                const evEnd = evStart + ev.duration * 1000;
                const slotKey = getSlotKey(new Date(ev.timestamp));

                let currentNode = rootNode;
                let currentPath = "";

                for (let i = 0; i < path.length; i++) {
                    const segment = path[i];
                    currentPath = currentPath ? `${currentPath} > ${segment}` : segment;

                    if (!currentNode.children.has(segment)) {
                        currentNode.children.set(segment, {
                            name: segment,
                            fullName: currentPath,
                            children: new Map(),
                            slotIntervals: new Map(),
                            depth: i
                        });
                    }
                    currentNode = currentNode.children.get(segment)!;

                    if (!currentNode.slotIntervals.has(slotKey)) {
                        currentNode.slotIntervals.set(slotKey, []);
                    }
                    currentNode.slotIntervals.get(slotKey)!.push({ start: evStart, end: evEnd });
                }
            }

            // Merge intervals helper
            const GAP_TOLERANCE_MS = 5 * 60 * 1000;
            const mergeIntervals = (intervals: Interval[]): Interval[] => {
                if (intervals.length === 0) return [];
                const sorted = [...intervals].sort((a, b) => a.start - b.start);
                const merged: Interval[] = [{ ...sorted[0] }];
                for (let i = 1; i < sorted.length; i++) {
                    const last = merged[merged.length - 1];
                    const current = sorted[i];
                    if (current.start <= last.end + GAP_TOLERANCE_MS) {
                        last.end = Math.max(last.end, current.end);
                    } else {
                        merged.push({ ...current });
                    }
                }
                return merged;
            };

            // Recursive function to convert ProcessNode to CategoryReport
            const buildReport = (node: ProcessNode): CategoryReport[] => {
                const reports: CategoryReport[] = [];

                for (const childNode of node.children.values()) {
                    const catReport: CategoryReport = {
                        name: childNode.name,
                        fullName: childNode.fullName,
                        totalDuration: 0,
                        slotStats: new Map(),
                        children: buildReport(childNode),
                        depth: childNode.depth
                    };

                    for (const [slotKey, intervals] of childNode.slotIntervals) {
                        const merged = mergeIntervals(intervals);
                        const duration = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / 1000;
                        catReport.slotStats.set(slotKey, duration);
                        catReport.totalDuration += duration;
                    }

                    reports.push(catReport);
                }

                return reports.sort((a, b) => {
                    if (a.name === "Uncategorized") return 1;
                    if (b.name === "Uncategorized") return -1;
                    return b.totalDuration - a.totalDuration;
                });
            };

            setReport(buildReport(rootNode));

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentDate, viewMode, includeAuto]);

    const handlePrevious = () => {
        if (viewMode === "day") setCurrentDate(d => subDays(d, 1));
        else if (viewMode === "week") setCurrentDate(d => subWeeks(d, 1));
        else if (viewMode === "month") setCurrentDate(d => subMonths(d, 1));
        else setCurrentDate(d => subYears(d, 1));
    };

    const handleNext = () => {
        if (viewMode === "day") setCurrentDate(d => addDays(d, 1));
        else if (viewMode === "week") setCurrentDate(d => addWeeks(d, 1));
        else if (viewMode === "month") setCurrentDate(d => addMonths(d, 1));
        else setCurrentDate(d => addYears(d, 1));
    };

    const handleViewModeChange = (val: ViewMode) => {
        setViewMode(val);
        setCurrentDate(new Date());
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
        if (viewMode === "month") return format(currentDate, "MMMM yyyy");
        return format(currentDate, "yyyy");
    };

    const downloadCSV = () => {
        const headers = ["Category", "Depth", "Total (h)", ...timeSlots.map(s => s.date && viewMode !== "day" ? format(s.date, "yyyy-MM-dd") : s.label)];

        // Helper to flatten the tree for CSV
        const flattenReport = (reports: CategoryReport[]): any[][] => {
            let rows: any[][] = [];
            for (const cat of reports) {
                const row = [
                    `"${cat.fullName}"`,
                    cat.depth,
                    (cat.totalDuration / 3600).toFixed(2),
                    ...timeSlots.map(s => {
                        const val = cat.slotStats.get(s.key) || 0;
                        return (val / 3600).toFixed(2);
                    })
                ];
                rows.push(row);
                if (cat.children.length > 0) {
                    rows = [...rows, ...flattenReport(cat.children)];
                }
            }
            return rows;
        };

        const rows = flattenReport(report).map(r => r.join(","));
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
                            <SelectItem value="year">This Year</SelectItem>
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

                    <div className="flex items-center space-x-2 bg-muted/40 px-3 py-1.5 rounded-full border border-border/40 ml-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="include-auto"
                                            checked={includeAuto}
                                            onChange={(e) => setIncludeAuto((e.target as HTMLInputElement).checked)}
                                        />
                                        <Label htmlFor="include-auto" className="text-xs font-semibold cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                                            <Filter className="h-3 w-3" />
                                            Include Auto
                                        </Label>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Include automatically generated categories from watchers</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Time Distribution</CardTitle>
                    <CardDescription>
                        {viewMode === "day" && "Hourly breakdown of activity."}
                        {viewMode === "week" && "Daily breakdown of activity for the week."}
                        {viewMode === "month" && "Daily breakdown of activity for the month."}
                        {viewMode === "year" && "Monthly breakdown of activity for the year."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0 border-t">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground animate-pulse">Loading report...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[200px] sticky left-0 bg-background z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Category</TableHead>
                                    <TableHead className="text-right font-bold bg-muted/20 w-[80px] px-4">Total</TableHead>
                                    {timeSlots.map(slot => (
                                        <TableHead key={slot.key} className="text-center min-w-[60px] px-1">
                                            <div className="text-xs font-semibold whitespace-nowrap">{slot.label}</div>
                                            {(viewMode === "month" || viewMode === "week") && slot.date && (
                                                <div className="text-[10px] text-muted-foreground uppercase font-medium">{format(slot.date, "EEE")}</div>
                                            )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.map((cat) => (
                                    <ReportRow
                                        key={cat.fullName}
                                        cat={cat}
                                        timeSlots={timeSlots}
                                        viewMode={viewMode}
                                        formatDuration={formatDuration}
                                    />
                                ))}
                                {report.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={timeSlots.length + 2} className="text-center py-20 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <p className="text-lg font-medium">No activity data found</p>
                                                <p className="text-sm">Try selecting a different time period or check your watchers.</p>
                                            </div>
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

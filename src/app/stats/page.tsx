"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fetchAllEvents } from "@/lib/data";
import { Event } from "@/lib/types";
import { classifyEvent, CategoryClass } from "@/lib/categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths, addMonths } from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCw, Download } from "lucide-react";

interface DailyStats {
    date: Date;
    duration: number; // seconds
}

interface CategoryReport {
    name: string;
    totalDuration: number;
    dailyStats: Map<string, number>; // date string -> seconds
}

export default function StatsPage() {
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
    const [report, setReport] = useState<CategoryReport[]>([]);
    const [daysInMonth, setDaysInMonth] = useState<Date[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const start = startOfMonth(month);
            const end = endOfMonth(month);

            // Generate days for table header
            const days = eachDayOfInterval({ start, end });
            setDaysInMonth(days);

            const allEvents = await fetchAllEvents(start, end);
            const settings = await api.getSettings();
            const classes = settings?.classes || [];

            // Process data
            const categoryMap = new Map<string, CategoryReport>();

            // Initialize map with top-level categories if known?
            // Better to build dynamically based on events.

            // Helper to get top level category name
            const getTopLevel = (path: string[] | null) => {
                if (!path || path.length === 0) return "Uncategorized";
                return path[0];
            };

            for (const ev of allEvents) {
                const path = classifyEvent(ev, classes);
                const categoryName = getTopLevel(path);

                if (!categoryMap.has(categoryName)) {
                    categoryMap.set(categoryName, {
                        name: categoryName,
                        totalDuration: 0,
                        dailyStats: new Map()
                    });
                }

                const catReport = categoryMap.get(categoryName)!;
                catReport.totalDuration += ev.duration;

                const dayKey = format(new Date(ev.timestamp), "yyyy-MM-dd");
                const currentDay = catReport.dailyStats.get(dayKey) || 0;
                catReport.dailyStats.set(dayKey, currentDay + ev.duration);
            }

            // Convert to array and sort by total duration
            const result = Array.from(categoryMap.values()).sort((a, b) => b.totalDuration - a.totalDuration);
            setReport(result);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [month]);

    const handlePreviousMonth = () => setMonth(subMonths(month, 1));
    const handleNextMonth = () => setMonth(addMonths(month, 1));

    const handleCurrentMonth = () => setMonth(startOfMonth(new Date()));

    const formatDuration = (seconds: number) => {
        if (seconds === 0) return "-";
        const hours = seconds / 3600;
        return hours.toFixed(1);
    };

    const downloadCSV = () => {
        // Headers: Category, Total, [Day 1, Day 2, ...]
        const headers = ["Category", "Total (h)", ...daysInMonth.map(d => format(d, "yyyy-MM-dd"))];

        // Rows
        const rows = report.map(cat => {
            const row = [
                `"${cat.name}"`, // Quote name to handle commas
                (cat.totalDuration / 3600).toFixed(2),
                ...daysInMonth.map(d => {
                    const val = cat.dailyStats.get(format(d, "yyyy-MM-dd")) || 0;
                    return (val / 3600).toFixed(2);
                })
            ];
            return row.join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        // Use application/octet-stream to force download and avoid browser UUID naming issues
        const blob = new Blob([csvContent], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ActivityWatch_Monthly_Report_${format(month, "yyyy-MM")}.csv`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Monthly Report</h1>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={handleCurrentMonth}>
                        This Month
                    </Button>
                    <div className="flex items-center space-x-1 border rounded-md">
                        <Button variant="ghost" size="icon" onClick={handlePreviousMonth} className="h-8 w-8">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="font-semibold min-w-[140px] text-center text-sm">
                            {format(month, "MMMM yyyy")}
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
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
                    <CardTitle>Hours per Category</CardTitle>
                    <CardDescription>
                        Daily breakdown of hours spent in each top-level category.
                    </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {loading ? (
                        <div className="p-8 text-center">Loading report...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px] sticky left-0 bg-background z-10 box-shadow-r">Category</TableHead>
                                    <TableHead className="text-right font-bold bg-muted/20">Total</TableHead>
                                    {daysInMonth.map(day => (
                                        <TableHead key={day.toISOString()} className="text-center min-w-[40px] px-1">
                                            <div className="text-xs">{format(day, "d")}</div>
                                            <div className="text-[10px] text-muted-foreground">{format(day, "EE")}</div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.map((cat) => (
                                    <TableRow key={cat.name}>
                                        <TableCell className="font-medium sticky left-0 bg-background z-10">{cat.name}</TableCell>
                                        <TableCell className="text-right font-bold bg-muted/20">
                                            {formatDuration(cat.totalDuration)}
                                        </TableCell>
                                        {daysInMonth.map(day => {
                                            const dayKey = format(day, "yyyy-MM-dd");
                                            const val = cat.dailyStats.get(dayKey) || 0;
                                            return (
                                                <TableCell key={dayKey} className={`text-center px-1 ${val > 0 ? 'bg-primary/5' : ''}`}>
                                                    {formatDuration(val)}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                                {report.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={daysInMonth.length + 2} className="text-center py-8 text-muted-foreground">
                                            No activity data found for this month.
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

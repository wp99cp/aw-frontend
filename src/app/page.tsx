"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fetchAllEvents } from "@/lib/data";
import { buildSunburstData, Settings, SunburstNode } from "@/lib/categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { subDays, startOfMonth, startOfYear, startOfDay, endOfDay } from "date-fns";
import { SunburstChart } from "@/components/dashboard/SunburstChart";
import { CategorySummary } from "@/components/dashboard/CategorySummary";
import { ActivityTimer } from "@/components/dashboard/ActivityTimer";

import { CategoryEventsList } from "@/components/dashboard/CategoryEventsList";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Event } from "@/lib/types";

const MANUAL_BUCKET_ID = "aw-watcher-manual-nextjs";

type TimeRange = "today" | "yesterday" | "last7days" | "thisMonth" | "thisYear";

export default function Home() {
  const [chartData, setChartData] = useState<SunburstNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("today");

  const [selectedCategory, setSelectedCategory] = useState<SunburstNode | null>(null);

  // Data state
  const [rawEvents, setRawEvents] = useState<Event[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [includeAfk, setIncludeAfk] = useState(false);

  const getDateRange = (range: TimeRange) => {
    const now = new Date();
    const end = endOfDay(now);
    let start = startOfDay(now);

    switch (range) {
      case "today":
        start = startOfDay(now);
        break;
      case "yesterday":
        start = startOfDay(subDays(now, 1));
        // For yesterday, end should be end of yesterday, not today
        return { start, end: endOfDay(subDays(now, 1)) };
      case "last7days":
        start = startOfDay(subDays(now, 7));
        break;
      case "thisMonth":
        start = startOfMonth(now);
        break;
      case "thisYear":
        start = startOfYear(now);
        break;
    }
    return { start, end };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Ensure manual bucket exists (idempotent check)
      try {
        await api.getBucket(MANUAL_BUCKET_ID);
      } catch (e) {
        try {
          await api.createBucket(MANUAL_BUCKET_ID, {
            client: "aw-watcher-manual-nextjs",
            type: "currentwindow",
            hostname: "nextjs-app",
          });
        } catch (createError) {
          console.error("Failed to create bucket", createError);
        }
      }

      const { start, end } = getDateRange(timeRange);

      // Fetch settings for categories
      let fetchedSettings: Settings | null = null;
      try {
        fetchedSettings = await api.getSettings();
        setSettings(fetchedSettings);
      } catch (e) {
        console.warn("Could not fetch settings", e);
      }

      // Fetch ALL events for the chart
      const allEvents = await fetchAllEvents(start, end);
      setRawEvents(allEvents);

      // Initial process will be triggered by useEffect

    } catch (err) {
      console.error(err);
      setLoading(false);
    } finally {
      // Don't set loading false here, wait for processing? 
      // Actually we can set loading false here, but chartData might be null for a split second.
      // Better to keep loading true until chartData is ready?
      // For simplicity, let's keep loading=false here, user might see "No data" briefly.
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  useEffect(() => {
    if (!rawEvents) return;

    let filteredEvents = rawEvents;

    if (!includeAfk) {
      filteredEvents = rawEvents.filter(e => e.data.status !== "afk");
    }

    if (settings && settings.classes) {
      setChartData(buildSunburstData(filteredEvents, settings.classes));
    } else {
      setChartData(buildSunburstData(filteredEvents, []));
    }
  }, [rawEvents, includeAfk, settings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center space-x-4 w-full sm:w-auto flex-wrap gap-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-afk"
              checked={includeAfk}
              onChange={(e) => setIncludeAfk(e.target.checked)}
            />
            <Label htmlFor="include-afk" className="text-sm cursor-pointer">Include AFK</Label>
          </div>

          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="last7days">Last 7 Days</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link href="/events/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Activity
            </Link>
          </Button>
        </div>
      </div>

      <ActivityTimer onActivityLogged={fetchData} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <Link href="/stats" className="group">
              <CardTitle className="group-hover:text-primary transition-colors flex items-center gap-2">
                Overview
                {/* Visual cue for clickability */}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-sm">↗</span>
              </CardTitle>
              <CardDescription>Activity distribution for {timeRange}</CardDescription>
            </Link>
          </CardHeader>
          <CardContent className="h-[400px]">
            {loading ? <div className="flex justify-center items-center h-full">Loading...</div> :
              chartData ? (
                <SunburstChart
                  data={chartData}
                  onCategorySelect={(node: SunburstNode | null) => setSelectedCategory(node)}
                />
              ) : <div>No data</div>}
          </CardContent>
        </Card>

        {/* Replaced 'Recent Manual Activities' with Category Summary OR Events List */}
        {selectedCategory ? (
          <CategoryEventsList
            node={selectedCategory}
            onBack={() => setSelectedCategory(null)}
            onActivityLogged={fetchData}
          />
        ) : (
          <CategorySummary data={chartData} timeRange={timeRange} onActivityLogged={fetchData} />
        )}
      </div>
    </div>
  );
}


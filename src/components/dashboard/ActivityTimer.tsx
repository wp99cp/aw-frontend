"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

import { Play, Square, Pause, Save, X, Edit2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Event } from "@/lib/types";
import { EventModal } from "@/components/events/EventModal";

const MANUAL_BUCKET_ID = "aw-watcher-manual-nextjs";

export function ActivityTimer({ onActivityLogged }: { onActivityLogged?: () => void }) {
    // Timer State
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("");
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [accumulated, setAccumulated] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Data State
    const [categories, setCategories] = useState<string[]>([]);
    const [recentEvents, setRecentEvents] = useState<Event[]>([]);

    // Edit Dialog State
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [eventToDelete, setEventToDelete] = useState<Event | null>(null);




    const loadRecentEvents = async () => {
        try {
            // Check/Create bucket with correct type 'manual' first
            try {
                const bucket = await api.getBucket(MANUAL_BUCKET_ID);
                if (bucket.type !== "manual") {
                    await api.createBucket(MANUAL_BUCKET_ID, {
                        client: "aw-watcher-manual-nextjs",
                        type: "manual",
                        hostname: "nextjs-app",
                    });
                }
            } catch {
                await api.createBucket(MANUAL_BUCKET_ID, {
                    client: "aw-watcher-manual-nextjs",
                    type: "manual",
                    hostname: "nextjs-app",
                });
            }

            const events = await api.getEvents(MANUAL_BUCKET_ID, { limit: 3 });
            setRecentEvents(events);
        } catch (e) {
            console.error("Failed to load recent events", e);
        }
    };

    // Initial Load
    useEffect(() => {
        // Load categories
        api.getSettings().then(settings => {
            const cats = new Set<string>();
            settings.classes.forEach(c => cats.add(c.name.join(" > ")));
            setCategories(Array.from(cats));
        }).catch(console.error);

        // Load recent events
        loadRecentEvents();

        // Load state from local storage
        const storedStart = localStorage.getItem("manual_activity_start");
        const storedTitle = localStorage.getItem("manual_activity_title");
        const storedCategory = localStorage.getItem("manual_activity_category");
        const storedAccumulated = localStorage.getItem("manual_activity_accumulated");
        const storedPaused = localStorage.getItem("manual_activity_paused");

        if (storedStart) setStartTime(new Date(storedStart));
        if (storedTitle) setTitle(storedTitle);
        if (storedCategory) setCategory(storedCategory);
        if (storedAccumulated) setAccumulated(Number(storedAccumulated));
        if (storedPaused === "true") setIsPaused(true);
    }, []);

    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (startTime && !isPaused) {
            interval = setInterval(() => {
                const now = new Date();
                const currentDuration = Math.floor((now.getTime() - startTime.getTime()) / 1000);
                setElapsed(accumulated + currentDuration);
            }, 1000);
        } else if (isPaused) {
            setElapsed(accumulated);
        } else {
            setElapsed(0);
        }
        return () => clearInterval(interval);
    }, [startTime, isPaused, accumulated]);



    const handleStart = () => {
        if (!title.trim()) {
            toast.error("Please enter an activity name");
            return;
        }
        const now = new Date();
        setStartTime(now);
        setIsPaused(false);
        setAccumulated(0);

        localStorage.setItem("manual_activity_start", now.toISOString());
        localStorage.setItem("manual_activity_title", title);
        localStorage.setItem("manual_activity_category", category);
        localStorage.setItem("manual_activity_accumulated", "0");
        localStorage.setItem("manual_activity_paused", "false");
    };

    const handlePause = () => {
        if (!startTime) return;
        const now = new Date();
        const currentSession = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const newAccumulated = accumulated + currentSession;

        setAccumulated(newAccumulated);
        setIsPaused(true);
        setStartTime(null);

        localStorage.setItem("manual_activity_accumulated", newAccumulated.toString());
        localStorage.setItem("manual_activity_paused", "true");
        localStorage.removeItem("manual_activity_start");
    };

    const handleResume = () => {
        const now = new Date();
        setStartTime(now);
        setIsPaused(false);

        localStorage.setItem("manual_activity_start", now.toISOString());
        localStorage.setItem("manual_activity_paused", "false");
    };

    const handleAbort = () => {
        resetTimerState();
        toast.info("Timer aborted");
    };

    const handleStop = async () => {
        let finalDuration = accumulated;
        if (startTime && !isPaused) {
            const now = new Date();
            finalDuration += (now.getTime() - startTime.getTime()) / 1000;
        }

        if (finalDuration < 1) {
            toast.error("Duration too short");
            return;
        }

        try {
            // Timestamp is end time minus duration
            // eslint-disable-next-line react-hooks/purity
            const timestamp = new Date(Date.now() - finalDuration * 1000).toISOString();

            await api.createEvent(MANUAL_BUCKET_ID, {
                timestamp: timestamp,
                duration: finalDuration,
                data: {
                    app: "Manual Activity",
                    title: title,
                    category: category,
                }
            });

            toast.success("Activity saved!");
            if (onActivityLogged) onActivityLogged();
            loadRecentEvents();
            resetTimerState();
        } catch (e) {
            console.error(e);
            toast.error("Failed to save activity");
        }
    };

    const resetTimerState = () => {
        setStartTime(null);
        setIsPaused(false);
        setAccumulated(0);
        setElapsed(0);
        setTitle("");
        setCategory("");

        localStorage.removeItem("manual_activity_start");
        localStorage.removeItem("manual_activity_title");
        localStorage.removeItem("manual_activity_category");
        localStorage.removeItem("manual_activity_accumulated");
        localStorage.removeItem("manual_activity_paused");
    };

    const openEditDialog = (event: Event) => {
        setEditingEvent(event);
    };

    const handleModalSave = () => {
        setEditingEvent(null);
        loadRecentEvents();
        if (onActivityLogged) onActivityLogged();
    };

    const handleDeleteRecent = (event: Event) => {
        setEventToDelete(event);
    };

    const confirmDelete = async () => {
        if (!eventToDelete || !eventToDelete.id) return;

        try {
            await api.deleteEvent(MANUAL_BUCKET_ID, eventToDelete.id);
            toast.success("Activity deleted");
            loadRecentEvents();
            if (onActivityLogged) onActivityLogged();
        } catch (e) {
            console.error(e);
            toast.error("Failed to delete activity");
        } finally {
            setEventToDelete(null);
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Card className="w-full">
            <CardContent className="p-6 space-y-4">
                {/* Timer Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                            <Input
                                placeholder="What are you working on?"
                                value={title}
                                onChange={(e) => {
                                    setTitle(e.target.value);
                                    if (startTime || isPaused) localStorage.setItem("manual_activity_title", e.target.value);
                                }}
                                disabled={!!startTime}
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <Select value={category} onValueChange={(val) => {
                                setCategory(val);
                                if (startTime || isPaused) localStorage.setItem("manual_activity_category", val);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end min-w-[200px]">
                        <div className="font-mono text-xl w-24 text-center">
                            {formatTime(elapsed)}
                        </div>

                        {startTime ? (
                            <>
                                <Button variant="outline" size="icon" onClick={handlePause} title="Pause">
                                    <Pause className="h-4 w-4" />
                                </Button>
                                <Button variant="destructive" size="icon" onClick={handleStop} title="Stop & Save">
                                    <Square className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                            <>
                                {isPaused ? (
                                    <>
                                        <Button variant="outline" size="icon" onClick={handleAbort} title="Abort">
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={handleResume} title="Resume">
                                            <Play className="h-4 w-4" />
                                        </Button>
                                        <Button variant="default" size="icon" onClick={handleStop} title="Save">
                                            <Save className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <Button size="icon" onClick={handleStart} disabled={!title.trim()}>
                                        <Play className="h-4 w-4" />
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Recent Activities */}
                {recentEvents.length > 0 && (
                    <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wider">Recent</p>
                        <div className="space-y-2">
                            {recentEvents.map(e => (
                                <div key={e.id} className="flex items-center justify-between text-sm group p-2 hover:bg-muted/50 rounded-md transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className="font-medium truncate">{e.data.title || "Untitled"}</span>
                                        {Boolean(e.data.category) && ( // Cast to boolean for TS
                                            <span className="text-xs px-1.5 py-0.5 bg-secondary rounded text-secondary-foreground truncate max-w-[100px]">
                                                {String(e.data.category)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <span>{formatTime(e.duration)}</span>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEditDialog(e)} title="Edit">
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={() => handleDeleteRecent(e)} title="Delete">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                <EventModal
                    isOpen={!!editingEvent}
                    event={editingEvent}
                    onClose={() => setEditingEvent(null)}
                    onSave={handleModalSave}
                />

                <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete this activity.
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
            </CardContent>
        </Card>
    );
}

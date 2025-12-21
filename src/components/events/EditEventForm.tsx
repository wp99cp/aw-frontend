"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { api } from "@/lib/api";
import { useEvents } from "@/context/EventsContext";
import { Event } from "@/lib/types";

const formSchema = z.object({
    title: z.string().min(1, "Title is required"),
    app: z.string().min(1, "Application is required"),
    tags: z.string(), // We'll handle comma separation manually
    timestamp: z.string().optional(),
    duration: z.string().optional(), // Using string for input handling, will convert to number
});

interface EditEventFormProps {
    bucketId: string;
    eventId: number;
    initialData?: Event;
    onSave?: () => void;
    onCancel?: () => void;
}

export function EditEventForm({ bucketId, eventId, initialData, onSave, onCancel }: EditEventFormProps) {
    const router = useRouter();
    const { events, fetchEvents } = useEvents(); // Use context to find event if not passed
    const [loading, setLoading] = useState(false);
    const [event, setEvent] = useState<Event | null>(initialData || null);
    const [copied, setCopied] = useState(false);

    const handleCopyRawData = async () => {
        if (!event) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
            setCopied(true);
            toast.success("Copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy");
        }
    };

    // If no initial data, try to find in context
    useEffect(() => {
        if (!event && events.length > 0) {
            const found = events.find(e => e.bucketId === bucketId && e.id === eventId);
            if (found) setEvent(found);
        }
    }, [bucketId, eventId, events, event]);

    const isManualEvent = bucketId === "aw-watcher-manual-nextjs";

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            app: "",
            tags: "",
            timestamp: "",
            duration: "",
        },
    });

    // Reset form when event data is available
    useEffect(() => {
        if (event) {
            // Format timestamp for datetime-local input (YYYY-MM-DDThh:mm)
            // Note: input type="datetime-local" expects simplified ISO format without Z
            const date = new Date(event.timestamp);
            // Adjust to local time string essentially for the input to show correct local time
            // Or use a library helper. date-fns format "yyyy-MM-dd'T'HH:mm" usually works
            const timestampStr = format(date, "yyyy-MM-dd'T'HH:mm");

            form.reset({
                title: event.data.title || "",
                app: event.data.app || "",
                tags: event.data.tags ? event.data.tags.join(", ") : "",
                timestamp: timestampStr,
                duration: event.duration.toString(),
            });
        }
    }, [event, form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!event || !event.bucketId || event.id === undefined) return;
        setLoading(true);

        // Calculate new timestamp and duration
        let newTimestamp = event.timestamp;
        let newDuration = event.duration;

        if (isManualEvent) {
            if (values.timestamp) {
                // Convert back to full ISO string
                newTimestamp = new Date(values.timestamp).toISOString();
            }
            if (values.duration) {
                newDuration = parseFloat(values.duration);
            }
        }

        // Strategy: Delete old, Create new
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, bucketId: _bucketId, ...restEvent } = event;
        const newEvent: Event = {
            ...restEvent,
            timestamp: newTimestamp,
            duration: newDuration,
            data: {
                ...event.data,
                title: values.title,
                app: values.app,
                tags: values.tags.split(",").map(s => s.trim()).filter(Boolean)
            }
        };

        try {
            await api.deleteEvent(event.bucketId, event.id);
            await api.createEvent(event.bucketId, newEvent);
            toast.success("Event updated");

            // Trigger refresh in context
            await fetchEvents();

            if (onSave) {
                onSave();
            } else {
                router.back();
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to update event");
        } finally {
            setLoading(false);
        }
    }

    if (!event && !initialData) {
        return (
            <div className="p-4 text-center">
                <p>Event not found. It may have been deleted or you refreshed the page.</p>
                <Button variant="link" onClick={() => router.push("/events")}>Back to Events</Button>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 h-full flex flex-col">
                <div className="flex-1 overflow-y-auto pr-2">
                    {/* Read-only / Editable Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Label className="md:col-span-1 text-right pt-2 text-muted-foreground">Timestamp</Label>
                        <div className="md:col-span-3">
                            {isManualEvent ? (
                                <FormField
                                    control={form.control}
                                    name="timestamp"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input type="datetime-local" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ) : (
                                <Input readOnly value={event ? format(new Date(event.timestamp), "PPpp") : ""} className="bg-muted" />
                            )}
                        </div>

                        <Label className="md:col-span-1 text-right pt-2 text-muted-foreground">Duration</Label>
                        <div className="md:col-span-3">
                            {isManualEvent ? (
                                <FormField
                                    control={form.control}
                                    name="duration"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input type="number" step="0.1" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ) : (
                                <Input readOnly value={event ? `${event.duration.toFixed(1)} seconds` : ""} className="bg-muted" />
                            )}
                        </div>

                        <Label className="md:col-span-1 text-right pt-2 text-muted-foreground">URL</Label>
                        <div className="md:col-span-3">
                            <div className="p-2 bg-muted rounded-md text-sm border min-h-[40px] break-all whitespace-pre-wrap">
                                {event?.data.url || "N/A"}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 border-t pt-4">
                        <h3 className="font-medium">Editable Details</h3>
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title (Window Title)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Activity Title" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="app"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Application</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Application Name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="tags"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tags (comma separated)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="coding, work, etc." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Raw Data */}
                    <div className="space-y-2 pt-6">
                        <div className="flex items-center justify-between">
                            <Label>Raw Data</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCopyRawData}
                                className="h-8 gap-1.5"
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                                {copied ? "Copied" : "Copy"}
                            </Button>
                        </div>
                        <div className="bg-muted p-4 rounded-md font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">
                            {event ? JSON.stringify(event, null, 2) : ""}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 py-4 border-t mt-auto">
                    <Button type="button" variant="outline" onClick={() => onCancel ? onCancel() : router.back()}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
            </form>
        </Form>
    );
}

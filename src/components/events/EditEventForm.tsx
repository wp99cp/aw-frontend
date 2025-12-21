"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Copy, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDuration } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
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
import { api } from "@/lib/api";
import { useEvents } from "@/context/EventsContext";
import { Event } from "@/lib/types";


const formSchema = z.object({
    title: z.string().min(1, "Title is required"),
    app: z.string().optional(),
    description: z.string().optional(),
    tags: z.string(), // We'll handle comma separation manually
    category: z.string().optional(), // Store joined path "Work > Programming"
    timestamp: z.string().optional(),
    duration: z.string().optional(), // Using string for input handling, will convert to number
});


interface EditEventFormProps {
    eventId?: number;
    bucketId?: string;
    initialData?: Event;
    onCancel?: () => void;
    onSave?: () => void;
}

export default function EditEventForm({ eventId, bucketId, initialData, onCancel, onSave }: EditEventFormProps) {

    const router = useRouter();
    const { events, fetchEvents } = useEvents();

    const [loading, setLoading] = useState(false);
    const [event, setEvent] = useState<Event | null>(initialData || null);
    const [copied, setCopied] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Fetch categories
    useEffect(() => {
        api.getSettings().then(settings => {
            if (settings && settings.classes) {
                const paths = settings.classes.map(c => c.name.join(" > "));
                setCategories(paths);
            }
        });
    }, []);

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
            description: "",
            tags: "",
            category: "",
            timestamp: "",
            duration: "",
        },
    });

    // Reset form when event data is available
    useEffect(() => {
        if (event) {
            // Format timestamp for datetime-local input (YYYY-MM-DDThh:mm)
            // Note: input type="datetime-local" expects simplified ISO format without Z
            // Adjust to local time string essentially for the input to show correct local time
            // Or use a library helper. date-fns format "yyyy-MM-dd'T'HH:mm" usually works
            const date = new Date(event.timestamp);
            const timestampStr = format(date, "yyyy-MM-dd'T'HH:mm");

            // Check for existing category in data
            const existingCat = (event.data.category && Array.isArray(event.data.category))
                ? event.data.category.join(" > ")
                : "";

            // For manual events, map app to description if description is missing (legacy support)
            let desc = event.data.description || "";
            if (isManualEvent && !desc && event.data.app) {
                desc = event.data.app;
            }

            form.reset({
                title: event.data.title || "",
                app: event.data.app || "",
                description: desc,
                tags: event.data.tags ? event.data.tags.join(", ") : "",
                category: existingCat || "_NO_CATEGORY_",
                timestamp: timestampStr,
                duration: event.duration.toString(),
            });
        }
    }, [event, form, isManualEvent]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!event) return;

        setLoading(true);
        const newTimestamp = values.timestamp ? new Date(values.timestamp).toISOString() : event.timestamp;
        const newDuration = values.duration ? parseFloat(values.duration) : event.duration;

        // Create a new event object with updated data
        // Exclude id and bucketId from the new event object as they are not part of the payload for createEvent
        const { id: _id, bucketId: _bucketId, ...restEvent } = event;

        // Prepare data object
        const newData: any = {
            ...event.data,
            title: values.title,
            tags: values.tags.split(",").map(s => s.trim()).filter(Boolean),
            category: (values.category && values.category !== "_NO_CATEGORY_") ? values.category.split(" > ") : undefined
        };

        if (isManualEvent) {
            newData.description = values.description;
            // Clear app for manual events as per request
            delete newData.app;
        } else {
            newData.app = values.app;
        }

        const newEvent: Event = {
            ...restEvent,
            timestamp: newTimestamp,
            duration: newDuration,
            data: newData
        };

        const targetBucketId = event.bucketId || bucketId;
        const targetEventId = event.id;

        if (!targetBucketId || targetEventId === undefined) {
            toast.error("Missing event ID or bucket ID");
            setLoading(false);
            return;
        }

        try {
            await api.deleteEvent(targetBucketId, targetEventId);
            await api.createEvent(targetBucketId, newEvent);
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
            setLoading(false); // Reset loading state
        }
    }

    const handleDelete = async () => {
        if (!event || !event.bucketId || event.id === undefined) return;

        setLoading(true);
        try {
            await api.deleteEvent(event.bucketId, event.id);
            toast.success("Event deleted");
            await fetchEvents();
            if (onSave) {
                // onSave usually refreshes and closes, which is what we want
                onSave();
            } else {
                router.back();
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete event");
        } finally {
            setLoading(false);
            setShowDeleteConfirm(false);
        }
    };

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
                                <Input readOnly value={event ? formatDuration(event.duration) : ""} className="bg-muted" />
                            )}
                            {isManualEvent && form.watch("duration") && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatDuration(parseFloat(form.watch("duration") || "0"))}
                                </p>
                            )}
                        </div>

                        {event?.data.url && event.data.url !== "N/A" && (
                            <>
                                <Label className="md:col-span-1 text-right pt-2 text-muted-foreground">URL</Label>
                                <div className="md:col-span-3">
                                    <div className="p-2 bg-muted rounded-md text-sm border min-h-[40px] break-all whitespace-pre-wrap">
                                        {event.data.url}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="space-y-4 border-t pt-4">
                        <h3 className="font-medium">Editable Details</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Activity Name (Title)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Activity Title" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {isManualEvent ? (
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Description"
                                                    className="min-h-[100px]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ) : (
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
                            )}

                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => {
                                    const isCustomCategory = field.value &&
                                        field.value !== "_NO_CATEGORY_" &&
                                        !categories.includes(field.value);

                                    return (
                                        <FormItem>
                                            <FormLabel>Category (Override)</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a category" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="_NO_CATEGORY_">No Category</SelectItem>
                                                    <SelectSeparator />
                                                    {isCustomCategory && (
                                                        <>
                                                            <SelectItem value={field.value || ""}>
                                                                {field.value} (Current)
                                                            </SelectItem>
                                                            <SelectSeparator />
                                                        </>
                                                    )}
                                                    {categories.map((cat) => (
                                                        <SelectItem key={cat} value={cat}>
                                                            {cat}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
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
                    </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-medium">Raw Data</h3>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyRawData}
                            disabled={!event}
                        >
                            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            {copied ? "Copied" : "Copy JSON"}
                        </Button>
                    </div>
                    <div className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono max-h-48 border">
                        <pre>{event ? JSON.stringify(event, null, 2) : "Loading..."}</pre>
                    </div>
                </div>


                <div className="flex justify-end gap-2 py-4 border-t mt-auto">
                    <div className="flex-1 mr-auto">
                        <Button type="button" variant="destructive" onClick={() => setShowDeleteConfirm(true)} disabled={loading}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                    <Button type="button" variant="outline" onClick={() => onCancel ? onCancel() : router.back()}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
            </form>

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the event.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Form >
    );
}


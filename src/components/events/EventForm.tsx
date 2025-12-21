"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";


export const formSchema = z.object({
    title: z.string().min(2, {
        message: "Title must be at least 2 characters.",
    }),
    description: z.string().optional(),
    tags: z.string().optional(), // Comma separated for input, parsed on submit
    durationMinutes: z.coerce.number().min(1, {
        message: "Duration must be at least 1 minute.",
    }),
    date: z.string(),
    time: z.string(),
});

interface EventFormProps {
    initialValues?: Partial<z.infer<typeof formSchema>>;
    onSuccess?: () => void;
}

export function EventForm({ initialValues, onSuccess }: EventFormProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [tagsList, setTagsList] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
            tags: "",
            durationMinutes: 60,
            date: new Date().toISOString().split("T")[0],
            time: new Date().toTimeString().split(" ")[0].substring(0, 5),
            ...initialValues
        },
    });

    const handleAddTag = () => {
        if (!tagInput.trim()) return;
        if (!tagsList.includes(tagInput.trim())) {
            setTagsList([...tagsList, tagInput.trim()]);
        }
        setTagInput("");
    };

    const handleRemoveTag = (tag: string) => {
        setTagsList(tagsList.filter(t => t !== tag));
    };

    const handleKeyDownTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setSubmitting(true);
        try {
            const bucketId = "aw-watcher-manual-nextjs";

            const dateTimeStr = `${values.date}T${values.time}:00`;
            const dateObj = new Date(dateTimeStr);
            const timestamp = dateObj.toISOString();
            const durationSecs = values.durationMinutes * 60;

            const event = {
                timestamp: timestamp,
                duration: durationSecs,
                data: {
                    title: values.title,
                    description: values.description,
                    tags: tagsList
                }
            };

            await api.createEvent(bucketId, event);

            if (onSuccess) {
                onSuccess();
            } else {
                router.push("/");
                router.refresh();
            }
        } catch (error) {
            console.error("Failed to submit event", error);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Activity Name (Title)</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Time Tracking" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Input placeholder="Additional details..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />


                {/* Tags Section */}
                <div className="space-y-2">
                    <FormLabel>Tags</FormLabel>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {tagsList.map(tag => (
                            <Badge key={tag} variant="secondary" className="px-2 py-1 flex items-center gap-1">
                                {tag}
                                <X
                                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                                    onClick={() => handleRemoveTag(tag)}
                                />
                            </Badge>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleKeyDownTag}
                            placeholder="Add a tag..."
                            className="flex-1"
                        />
                        <Button type="button" variant="outline" onClick={handleAddTag}>Add</Button>
                    </div>
                    <FormDescription>Press Enter to add tags.</FormDescription>
                </div>

                <div className="flex gap-4">
                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="time"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>Start Time</FormLabel>
                                <FormControl>
                                    <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="durationMinutes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Duration (minutes)</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} value={field.value as number} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save Activity"}
                </Button>
            </form>
        </Form>
    );
}


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

const formSchema = z.object({
    title: z.string().min(2, {
        message: "Title must be at least 2 characters.",
    }),
    app: z.string().min(1, { message: "Please select or type an app/category." }),
    tags: z.string().optional(), // Comma separated for input, parsed on submit
    durationMinutes: z.coerce.number().min(1, {
        message: "Duration must be at least 1 minute.",
    }),
    date: z.string(),
    time: z.string(),
});

export function EventForm() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [openAppCombobox, setOpenAppCombobox] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [tagsList, setTagsList] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            app: "",
            tags: "",
            durationMinutes: 60,
            date: new Date().toISOString().split("T")[0],
            time: new Date().toTimeString().split(" ")[0].substring(0, 5),
        },
    });

    useEffect(() => {
        // Fetch recent manual events to get unique app names for suggestions
        const loadSuggestions = async () => {
            try {
                const bucketId = "aw-watcher-manual-nextjs"; // Configurable
                // Fetch last 100 events
                const events = await api.getEvents(bucketId, { limit: 100 });
                if (events) {
                    const apps = new Set<string>();
                    events.forEach((e) => {
                        if (e.data.app) apps.add(e.data.app);
                    });
                    setSuggestions(Array.from(apps).sort());
                }
            } catch (e) {
                console.warn("Could not load suggestions", e);
            }
        };
        loadSuggestions();
    }, []);

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
                    app: values.app,
                    title: values.title,
                    tags: tagsList // Save tags array
                }
            };

            await api.createEvent(bucketId, event);

            router.push("/");
            router.refresh();
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
                    name="app"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Category / App</FormLabel>
                            <Popover open={openAppCombobox} onOpenChange={setOpenAppCombobox}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openAppCombobox}
                                            className={cn(
                                                "w-full justify-between",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value
                                                ? field.value
                                                : "Select or type app..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                    <Command>
                                        <CommandInput
                                            placeholder="Search or type new..."
                                            onValueChange={(search) => {
                                                // If exact match doesn't exist, we can still set it?
                                                // Actually CommandInput filters.
                                                // We want to allow creating new ones.
                                                // We can use the props to handle this?
                                                // Or just simpler:
                                                // If 'search' is not empty, allow selecting it as 'Create "search"'
                                            }}
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                No app found.
                                            </CommandEmpty>
                                            <CommandGroup heading="Suggestions">
                                                {suggestions.map((app) => (
                                                    <CommandItem
                                                        value={app}
                                                        key={app}
                                                        onSelect={() => {
                                                            form.setValue("app", app);
                                                            setOpenAppCombobox(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                app === field.value
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        {app}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                            {/* Allow custom input via a pseudo-item if using complex logic, 
                                                but for simplicity with shadcn Command, custom input is tricky without 'creatable' logic.
                                                Alternative: standard input with autocomplete datalist, OR 
                                                just Typed Input that has a dropdown.
                                                
                                                Let's stick to simple Input for creating new if not in list? 
                                                No, common pattern: "Create 'XYZ'" item.
                                             */}
                                            <CommandGroup heading="Actions">
                                                <CommandItem
                                                    onSelect={(inputValue) => {
                                                        // This catches the typed value if we can get it?
                                                        // shadcn Command doesn't easily expose current search value here.
                                                        // workaround:
                                                        // We can force the user to type in the Input field if they want custom?
                                                        // Or better: Use combobox for selection, but Input for typing?
                                                        // Let's implement fully custom 'Create' logic if we can access query.
                                                        // Simplest: just an Input field that shows suggestions below?
                                                        // Reverting to Input with Datalist style might be easier but less pretty.
                                                        // Let's try to make the Command work by assuming the user types into a specific state.
                                                    }}
                                                    className="hidden" // Placeholder
                                                >
                                                </CommandItem>
                                            </CommandGroup>

                                        </CommandList>
                                    </Command>
                                    {/* Workaround for Create New: 
                                        Input inside Popover is tricky.
                                        Let's change approach: 
                                        Standard Input, but with a dropdown of suggestions.
                                    */}
                                </PopoverContent>
                            </Popover>

                            {/* Fallback / Alternative implementation: Simple Input with Suggestions */}
                            <div className="relative">
                                <Input
                                    placeholder="Work, Meeting, etc."
                                    {...field}
                                    list="app-suggestions"
                                    autoComplete="off"
                                />
                                <datalist id="app-suggestions">
                                    {suggestions.map(s => <option key={s} value={s} />)}
                                </datalist>
                            </div>
                            <FormDescription>
                                Broad category for this activity. Type to create new.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Activity Title</FormLabel>
                            <FormControl>
                                <Input placeholder="Project X meeting" {...field} />
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


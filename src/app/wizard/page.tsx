"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fetchAllEvents } from "@/lib/data";
import { Event, UncategorizedGroup, FilterType } from "@/lib/types";
import { classifyEvent, Settings, CategoryClass } from "@/lib/categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Wand2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { generateRegexSuggestions, RegexSuggestion } from "@/actions/suggestions";

import { EventModal } from "@/components/events/EventModal";



export default function WizardPage() {
    const [loading, setLoading] = useState(true);
    // const [analyzing, setAnalyzing] = useState(false);
    const [groups, setGroups] = useState<UncategorizedGroup[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [rawEvents, setRawEvents] = useState<Event[]>([]);
    const [filterType, setFilterType] = useState<FilterType>("all");
    const [selectedGroup, setSelectedGroup] = useState<UncategorizedGroup | null>(null);

    // For creating new rule
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newRegex, setNewRegex] = useState("");
    const [regexSuggestions, setRegexSuggestions] = useState<RegexSuggestion[]>([]);
    const [existingCategories, setExistingCategories] = useState<string[]>([]);

    // For viewing event details
    const [viewingEvent, setViewingEvent] = useState<Event | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (rawEvents.length > 0 && settings) {
            processEvents(rawEvents, settings, filterType);
        }
    }, [rawEvents, settings, filterType]);

    const loadData = async () => {
        setLoading(true);
        try {
            const currentSettings = await api.getSettings();
            setSettings(currentSettings);

            // Extract unique categories for suggestions
            const uniqueCats = new Set<string>();
            if (currentSettings?.classes) {
                const traverse = (classes: CategoryClass[]) => {
                    classes.forEach(c => {
                        if (Array.isArray(c.name)) {
                            uniqueCats.add(c.name.join(" > "));
                            if (c.name.length > 1) {
                                uniqueCats.add(c.name[0]);
                            }
                        }
                    });
                };
                traverse(currentSettings.classes);
            }
            setExistingCategories(Array.from(uniqueCats).sort());

            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 7);

            // setAnalyzing(true);
            const allEvents = await fetchAllEvents(start, end);
            setRawEvents(allEvents); // Trigger useEffect for processing

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            // setAnalyzing(false);
        }
    };

    const processEvents = (events: Event[], currentSettings: Settings, filter: FilterType) => {
        const uncategorized: Event[] = [];
        const ruleClasses = currentSettings.classes || [];

        for (const ev of events) {
            const result = classifyEvent(ev, ruleClasses);
            if (!result || result.name.length === 0 || result.name[0] === "Uncategorized") {
                uncategorized.push(ev);
            }
        }

        const grouped = new Map<string, UncategorizedGroup>();
        for (const ev of uncategorized) {
            const app = ev.data.app || "Unknown";
            const url = ev.data.url;
            const title = ev.data.title || "";

            // Filter logic
            if (filter === "websites" && !url) continue;
            if (filter === "apps" && url) continue; // Approximate: events with URL are "websites", others are "apps"
            if (app.toLowerCase() === "unknown" && !url) continue;

            let key = app;
            let displayApp = app;
            let isWebsite = false;
            let domain = undefined;

            if (url) {
                try {
                    const hostname = new URL(url).hostname;
                    domain = hostname;
                    isWebsite = true;
                    if (filter === "websites") {
                        // In website mode, group by domain
                        key = hostname;
                        displayApp = hostname;
                    }
                } catch {
                    // invalid url
                }
            }

            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
                    events: [],
                    duration: 0,
                    appName: displayApp,
                    title: title,
                    domain,
                    isWebsite
                });
            }
            const g = grouped.get(key)!;
            g.events.push(ev);
            g.duration += ev.duration;
        }

        const result = Array.from(grouped.values()).sort((a, b) => b.duration - a.duration);
        setGroups(result);
    };

    const handleSelectGroup = async (g: UncategorizedGroup) => {
        setSelectedGroup(g);

        // Generate regex suggestions (server action)
        const suggestions = await generateRegexSuggestions(g);
        setRegexSuggestions(suggestions);

        // Default to the first suggestion if available, otherwise fallback to app name/domain logic
        // Basic intelligence: if app name matches an existing category, suggest it
        // Or if it sounds like "Code" suggest "Work > Programming"? (Hard without NLP)

        if (filterType === "websites" && g.domain) {
            setNewCategoryName(g.domain);
            if (suggestions.length > 0) {
                setNewRegex(suggestions[0].regex);
            } else {
                setNewRegex(g.domain);
            }
        } else {
            // Pick a reasonable default for category name
            // If the top suggestion is a title/domain and has a high score, maybe it's better?
            // For now, keep app name as default but if the top suggestion is high score, use it for regex
            setNewCategoryName(g.appName);

            if (suggestions.length > 0) {
                setNewRegex(suggestions[0].regex);
                // If it's a very high confidence title suggestion, maybe it should be the category name too?
                // e.g. "pnpm" instead of "Terminator"
                if (suggestions[0].type === "title" && (suggestions[0].score || 0) > 0.8) {
                    setNewCategoryName(suggestions[0].regex);
                }
            } else {
                setNewRegex(g.appName);
            }
        }
    };

    const handleCreateRule = async () => {
        if (!settings || !selectedGroup) return;

        try {
            // Parse hierarchy: "Parent > Child" -> ["Parent", "Child"]
            const nameArray = newCategoryName.split(">").map(s => s.trim()).filter(s => s.length > 0);

            if (nameArray.length === 0) {
                toast.error("Please enter a category name");
                return;
            }

            const newRule: CategoryClass = {
                id: Date.now(), // simple ID generation
                name: nameArray,
                rule: {
                    type: "regex",
                    regex: newRegex
                },
                data: {}
            };

            const updatedClasses = [...(settings.classes || []), newRule];
            const updatedSettings: Settings = { ...settings, classes: updatedClasses };

            await api.saveSettings(updatedSettings);

            // Store references for undo
            const removedGroup = selectedGroup;
            const previousSettings = settings;
            const previousCategories = [...existingCategories];

            // Remove the group from the list locally
            setGroups(groups.filter(g => g.key !== selectedGroup.key));
            setSelectedGroup(null);
            setSettings(updatedSettings);

            // Re-fetch existing categories to update suggestions
            const uniqueCats = new Set(existingCategories);
            uniqueCats.add(nameArray.join(" > "));
            if (nameArray.length > 1) uniqueCats.add(nameArray[0]);
            setExistingCategories(Array.from(uniqueCats).sort());

            toast.success(`Rule created! Future events for ${removedGroup.appName} will be categorized as ${nameArray.join(" > ")}.`, {
                action: {
                    label: "Undo",
                    onClick: async () => {
                        try {
                            // Restore previous settings (without the new rule)
                            await api.saveSettings(previousSettings);
                            setSettings(previousSettings);

                            // Restore the group to the list
                            setGroups(prevGroups => [...prevGroups, removedGroup].sort((a, b) => b.duration - a.duration));

                            // Restore previous categories
                            setExistingCategories(previousCategories);

                            toast.success("Rule undone successfully.");
                        } catch {
                            toast.error("Failed to undo rule.");
                        }
                    }
                }
            });

        } catch {
            // console.error("Failed to save settings", e);
            toast.error("Failed to save rule.");
        }
    };

    const applySuggestion = (cat: string) => {
        setNewCategoryName(cat);
    };

    if (loading) return <div className="p-8 text-center">Loading wizard data...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Category Wizard</h1>
                <p className="text-muted-foreground mt-2">
                    Help ActivityWatch understand your activities. Select an uncategorized app from the list below and assign it a category.
                    You can create hierarchies using the &quot; &gt; &quot; separator (e.g., &quot;Work &gt; Programming&quot;).
                </p>
                <div className="text-sm text-muted-foreground mt-1">
                    Found {groups.length} groups of uncategorized activity in the last 7 days.
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Uncategorized</h2>
                        <div className="w-[180px]">
                            <Select value={filterType} onValueChange={(v: FilterType) => {
                                setFilterType(v);
                                setSelectedGroup(null);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Activities</SelectItem>
                                    <SelectItem value="websites">Websites</SelectItem>
                                    <SelectItem value="apps">Applications</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {groups.map(g => (
                            <Card
                                key={g.key}
                                className={`cursor-pointer transition-all hover:bg-muted/50 ${selectedGroup?.key === g.key ? 'border-primary ring-1 ring-primary bg-muted/30' : ''}`}
                                onClick={() => handleSelectGroup(g)}
                            >
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="overflow-hidden">
                                        <div className="font-semibold truncate">{g.appName}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {(g.duration / 60).toFixed(0)} mins • {g.events.length} events
                                        </div>
                                    </div>
                                    {selectedGroup?.key === g.key && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    {groups.length === 0 && (
                        <div className="text-center py-10 border-2 border-dashed rounded-lg">
                            <Wand2 className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">All your activities are categorized! Great job.</p>
                        </div>
                    )}
                </div>

                <div>
                    {selectedGroup ? (
                        <div className="sticky top-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Create Category Rule</CardTitle>
                                    <CardDescription>
                                        Classify future events for <strong>{selectedGroup.appName}</strong>.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-3">
                                        <Label>Category Name</Label>
                                        <Input
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="e.g. Work > Programming"
                                        />

                                        {regexSuggestions.filter(s => s.type === "title").length > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground font-semibold">Suggested from Title:</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {regexSuggestions.filter(s => s.type === "title").slice(0, 6).map((s, idx) => (
                                                        <Badge
                                                            key={idx}
                                                            variant="outline"
                                                            className="cursor-pointer hover:bg-primary/20"
                                                            onClick={() => {
                                                                setNewCategoryName(s.regex);
                                                                setNewRegex(s.regex);
                                                            }}
                                                        >
                                                            {s.regex}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground font-semibold">Existing Categories:</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {existingCategories.slice(0, 8).map(cat => (
                                                    <Badge
                                                        key={cat}
                                                        variant="secondary"
                                                        className="cursor-pointer hover:bg-secondary/80"
                                                        onClick={() => applySuggestion(cat)}
                                                    >
                                                        {cat}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Tip: Use &quot; &gt; &quot; to create subcategories. Click a suggestion above to use it.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Regex Pattern</Label>
                                        <Input
                                            value={newRegex}
                                            onChange={(e) => setNewRegex(e.target.value)}
                                            placeholder="Regex pattern"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Matches against app name or window title (case insensitive).
                                        </p>

                                        {regexSuggestions.length > 0 && (
                                            <div className="space-y-2 pt-2">
                                                <Label className="text-xs text-muted-foreground font-semibold">Suggested Patterns:</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {regexSuggestions.map((suggestion, idx) => (
                                                        <Badge
                                                            key={idx}
                                                            variant={newRegex === suggestion.regex ? "default" : "outline"}
                                                            className="cursor-pointer hover:bg-primary/20"
                                                            onClick={() => setNewRegex(suggestion.regex)}
                                                        >
                                                            {suggestion.label}: {suggestion.regex}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-muted p-3 rounded text-xs space-y-1">
                                        <div className="font-semibold mb-2">Sample Matches (click for details):</div>
                                        {selectedGroup.events.slice(0, 3).map((e, i) => (
                                            <div
                                                key={i}
                                                className="truncate opacity-70 border-b border-border/50 last:border-0 pb-1 last:pb-0 cursor-pointer hover:opacity-100 hover:text-primary transition-opacity"
                                                onClick={() => setViewingEvent(e)}
                                            >
                                                <span className="font-mono">{e.data.app}</span> - {e.data.title}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-between bg-muted/20 p-4">
                                    <Button variant="ghost" onClick={() => setSelectedGroup(null)}>Cancel</Button>
                                    <Button onClick={handleCreateRule}>
                                        <Wand2 className="mr-2 h-4 w-4" />
                                        Create Rule
                                    </Button>
                                </CardFooter>
                            </Card>
                        </div>
                    ) : (
                        <div className="sticky top-6 h-[200px] flex items-center justify-center border-2 border-dashed rounded-lg p-10 text-muted-foreground bg-muted/10">
                            Select an app from the list to categorize it.
                        </div>
                    )}
                </div>
            </div>

            <EventModal
                isOpen={!!viewingEvent}
                event={viewingEvent}
                onClose={() => setViewingEvent(null)}
            />
        </div>
    );
}


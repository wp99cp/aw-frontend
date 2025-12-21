import { UncategorizedGroup } from "./types";

export interface RegexSuggestion {
    label: string;
    regex: string;
    type: "app" | "domain" | "title" | "composite";
}

// Common stop words to exclude from frequency analysis (60+ meaningless words)
const STOP_WORDS = new Set([
    // Basic English stop words
    "the", "and", "or", "to", "in", "on", "at", "of", "for", "with", "by", "from", "up", "about",
    "into", "over", "after", "is", "a", "an", "my", "your", "this", "that", "it", "as", "be", "was",

    // Common UI/browser terms
    "new", "tab", "window", "document", "page", "home", "dashboard", "profile", "settings", "search",
    "google", "chrome", "firefox", "mozilla", "microsoft", "edge", "safari", "browser",

    // Common app terms  
    "application", "app", "file", "edit", "view", "help", "menu", "tools", "options", "preferences",

    // Time/date related
    "time", "date", "today", "yesterday", "now", "current", "recent", "latest", "updated",

    // Generic metadata
    "title", "source", "name", "type", "status", "info", "details", "data", "content", "text",

    // Numbers/counts
    "first", "second", "last", "next", "previous", "more", "less", "all", "some", "none", "other",

    // Actions
    "open", "close", "save", "load", "create", "delete", "add", "remove", "copy", "paste", "undo",

    // Layout/navigation
    "top", "bottom", "left", "right", "center", "main", "sidebar", "header", "footer", "nav",

    // States
    "loading", "waiting", "processing", "ready", "done", "complete", "error", "success", "failed",

    // Misc common
    "activitywatch", "untitled", "unknown", "default", "general", "basic", "advanced", "custom",
    "online", "offline", "public", "private", "user", "account", "login", "logout", "sign"
]);

export function generateRegexSuggestions(group: UncategorizedGroup): RegexSuggestion[] {
    const suggestions: RegexSuggestion[] = [];
    const seen = new Set<string>();

    const addSuggestion = (label: string, regex: string, type: RegexSuggestion["type"]) => {
        if (!seen.has(regex)) {
            suggestions.push({ label, regex, type });
            seen.add(regex);
        }
    };

    // 1. App Name (Exact)
    // Escape special characters for regex
    const escapedApp = escapeRegex(group.appName);
    addSuggestion(`App: ${group.appName}`, escapedApp, "app");

    // 2. Domain (if website)
    if (group.isWebsite && group.domain) {
        const escapedDomain = escapeRegex(group.domain);
        addSuggestion(`Domain: ${group.domain}`, escapedDomain, "domain");
    }

    // 3. Frequent words in titles
    const wordCounts = new Map<string, number>();
    group.events.forEach(e => {
        const title = e.data.title;
        if (title && typeof title === "string") {
            // Split by non-alphanumeric chars
            const words = title.split(/[^a-zA-Z0-9]+/);
            words.forEach(w => {
                const lower = w.toLowerCase();
                if (w.length > 3 && !STOP_WORDS.has(lower) && Number.isNaN(Number(w))) {
                    wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
                }
            });
        }
    });

    // Sort by frequency
    const sortedWords = Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Take top 5

    sortedWords.forEach(([word, count]) => {
        // Only suggest if it appears in a significant portion of events (e.g., > 20% or if count > 2)
        if (count > 2 || count / group.events.length > 0.2) {
            addSuggestion(`Word: ${word}`, word, "title");
            // Also suggest App + Word composite if app is generic
            if (group.appName && !group.isWebsite) {
                addSuggestion(`App + "${word}"`, `${escapedApp}.*${word}`, "composite");
            }
        }
    });

    return suggestions;
}

function escapeRegex(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

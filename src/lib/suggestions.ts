import { UncategorizedGroup } from "./types";

export interface RegexSuggestion {
    label: string;
    regex: string;
    type: "app" | "domain" | "title" | "composite";
}

// Common stop words to exclude from frequency analysis
const STOP_WORDS = new Set([
    // Basic English stop words
    "the", "and", "or", "to", "in", "on", "at", "of", "for", "with", "by", "from", "up", "about",
    "into", "over", "after", "is", "a", "an", "my", "your", "this", "that", "it", "as", "be", "was",
    "are", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare", "ought", "used", "not",

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
    "online", "offline", "public", "private", "user", "account", "login", "logout", "sign",

    // ActivityWatch specific / tracking terms
    "watcher", "activity", "tracker", "tracking", "watch", "monitor", "frontend", "backend",

    // Programming/development terms (often too generic)
    "python", "javascript", "typescript", "node", "react", "nextjs", "next", "build", "best",
    "alternative", "code", "coding", "project", "projects", "repo", "repository", "github",
    "gitlab", "bitbucket", "version", "release", "master", "main", "branch", "commit",

    // Common web terms
    "http", "https", "www", "html", "css", "json", "xml", "api", "rest", "websocket",

    // Common adjectives and descriptors (too generic for categorization)
    "free", "open", "cross", "platform", "extensible", "simple", "easy", "fast", "quick",
    "small", "large", "big", "full", "modern", "powerful", "lightweight", "flexible",
    "secure", "safe", "smart", "clean", "beautiful", "awesome", "great", "good", "nice",
    "super", "ultra", "pro", "lite", "plus", "mini", "max", "premium", "enterprise",
    "personal", "professional", "portable", "native", "hybrid", "official", "unofficial",
    "beta", "alpha", "stable", "experimental", "preview", "demo", "sample", "example",
    "test", "testing", "debug", "development", "production", "staging", "local",

    // Common nouns used in software descriptions
    "tool", "tools", "utility", "utilities", "library", "framework", "plugin", "extension",
    "module", "package", "component", "system", "service", "server", "client", "manager",
    "viewer", "editor", "reader", "writer", "builder", "generator", "converter", "compiler",
    "installer", "launcher", "runner", "helper", "handler", "wrapper", "interface", "guide",
    "documentation", "docs", "manual", "tutorial", "readme", "changelog", "license",

    // German common words (since you have German content)
    "eine", "einen", "einer", "eines", "einem", "der", "die", "das", "den", "dem", "des",
    "und", "oder", "aber", "wenn", "dann", "auch", "noch", "schon", "hier", "dort",
    "konfigurieren", "konfigurierung", "remote", "repository", "fork", "pull", "request",

    // Common filler words
    "using", "based", "built", "made", "written", "powered", "inspired", "designed",
    "created", "developed", "maintained", "supported", "available", "compatible", "works",
    "automated", "automatic", "dynamic", "static", "interactive", "integrated", "unified"
]);

export function generateRegexSuggestions(group: UncategorizedGroup): RegexSuggestion[] {
    const suggestions: RegexSuggestion[] = [];
    const seen = new Set<string>();

    const addSuggestion = (label: string, regex: string, type: RegexSuggestion["type"]) => {
        // Also check if the regex itself is a stop word (case-insensitive)
        if (!seen.has(regex.toLowerCase()) && !STOP_WORDS.has(regex.toLowerCase())) {
            suggestions.push({ label, regex, type });
            seen.add(regex.toLowerCase());
        }
    };

    // 1. App Name (Exact) - only if not a stop word
    const escapedApp = escapeRegex(group.appName);
    if (!STOP_WORDS.has(group.appName.toLowerCase())) {
        addSuggestion(`App: ${group.appName}`, escapedApp, "app");
    }

    // 2. Domain (if website)
    if (group.isWebsite && group.domain) {
        const escapedDomain = escapeRegex(group.domain);
        addSuggestion(`Domain: ${group.domain}`, escapedDomain, "domain");
    }

    // 3. Frequent words in titles
    // Use lowercase as key to avoid case-sensitive duplicates, store original casing for display
    const wordCounts = new Map<string, { original: string; count: number }>();
    group.events.forEach(e => {
        const title = e.data.title;
        if (title && typeof title === "string") {
            // Split by non-alphanumeric chars
            const words = title.split(/[^a-zA-Z0-9]+/);
            words.forEach(w => {
                const lower = w.toLowerCase();
                if (w.length > 3 && !STOP_WORDS.has(lower) && Number.isNaN(Number(w))) {
                    const existing = wordCounts.get(lower);
                    if (existing) {
                        existing.count += 1;
                    } else {
                        wordCounts.set(lower, { original: w, count: 1 });
                    }
                }
            });
        }
    });

    // Sort by frequency
    const sortedWords = Array.from(wordCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5); // Take top 5

    sortedWords.forEach(([lowerWord, { original, count }]) => {
        // Only suggest if it appears in a significant portion of events (e.g., > 20% or if count > 2)
        if (count > 2 || count / group.events.length > 0.2) {
            addSuggestion(`Word: ${original}`, original, "title");
            // Also suggest App + Word composite if app is generic and app name isn't a stop word
            if (group.appName && !group.isWebsite && !STOP_WORDS.has(group.appName.toLowerCase())) {
                addSuggestion(`App + "${original}"`, `${escapedApp}.*${original}`, "composite");
            }
        }
    });

    return suggestions;
}

function escapeRegex(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

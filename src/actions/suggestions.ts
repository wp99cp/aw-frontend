"use server";

import { UncategorizedGroup } from "@/lib/types";

export interface RegexSuggestion {
    label: string;
    regex: string;
    type: "app" | "domain" | "title" | "composite";
    score?: number; // Usefulness score for sorting
}

// Pre-built set of common English words (top ~500 from Google corpus)
// These are too generic to be useful for categorization
const COMMON_WORDS = new Set([
    "the", "of", "and", "to", "a", "in", "for", "is", "on", "that",
    "by", "this", "with", "i", "you", "it", "not", "or", "be", "are",
    "from", "at", "as", "your", "all", "have", "new", "more", "an", "was",
    "we", "will", "home", "can", "us", "about", "if", "page", "my", "has",
    "search", "free", "but", "our", "one", "other", "do", "no", "information", "time",
    "they", "site", "he", "up", "may", "what", "which", "their", "news", "out",
    "use", "any", "there", "see", "only", "so", "his", "when", "contact", "here",
    "business", "who", "web", "also", "now", "help", "get", "pm", "view", "online",
    "first", "am", "been", "would", "how", "were", "me", "services", "some", "these",
    "click", "its", "like", "service", "than", "find", "price", "date", "back", "top",
    "people", "had", "list", "name", "just", "over", "state", "year", "day", "into",
    "email", "two", "health", "world", "re", "next", "used", "go", "work", "last",
    "most", "products", "music", "buy", "data", "make", "them", "should", "product", "system",
    "post", "her", "city", "add", "policy", "number", "such", "please", "available", "copyright",
    "support", "message", "after", "best", "software", "then", "jan", "good", "video", "well",
    "where", "info", "rights", "public", "books", "high", "school", "through", "each", "links",
    "she", "review", "years", "order", "very", "privacy", "book", "items", "company", "read",
    "group", "need", "many", "user", "said", "de", "does", "set", "under", "general",
    "research", "university", "january", "mail", "full", "map", "reviews", "program", "life", "know",
    "games", "way", "days", "management", "part", "could", "great", "united", "hotel", "real",
    "item", "international", "center", "must", "store", "travel", "comments", "made", "development", "report",
    "off", "member", "details", "line", "terms", "before", "hotels", "did", "send", "right",
    "type", "because", "local", "those", "using", "results", "office", "education", "national", "car",
    "design", "take", "posted", "internet", "address", "community", "within", "states", "area", "want",
    "phone", "dvd", "shipping", "reserved", "subject", "between", "forum", "family", "long", "based",
    "code", "show", "even", "black", "check", "special", "prices", "website", "index", "being",
    "women", "much", "sign", "file", "link", "open", "today", "technology", "south", "case",
    "project", "same", "pages", "version", "section", "own", "found", "sports", "house", "related",
    "security", "both", "county", "american", "photo", "game", "members", "power", "while", "care",
    "network", "down", "computer", "systems", "three", "total", "place", "end", "following", "download",
    "him", "without", "per", "access", "think", "north", "resources", "current", "posts", "big",
    "media", "law", "control", "water", "history", "pictures", "size", "art", "personal", "since",
    "including", "guide", "shop", "directory", "board", "location", "change", "white", "text", "small",
    "rating", "rate", "government", "children", "during", "return", "students", "shopping", "account", "times",
    "sites", "level", "digital", "profile", "previous", "form", "events", "love", "old", "john",
    "main", "call", "hours", "image", "department", "title", "description", "non", "insurance", "another",
    "why", "shall", "property", "class", "cd", "still", "money", "quality", "every", "listing",
    "content", "country", "private", "little", "visit", "save", "tools", "low", "reply", "customer",
    "december", "compare", "movies", "include", "college", "value", "article", "yet", "play", "card",
    "jobs", "provide", "source", "author", "different", "press", "learn", "sale", "around", "print",
    "course", "job", "canada", "process", "teen", "room", "stock", "training", "too", "credit",
    "point", "join", "science", "men", "categories", "advanced", "west", "sales", "look", "english",
    "left", "team", "estate", "box", "conditions", "select", "windows", "photos", "thread", "week",
    "category", "note", "live", "large", "gallery", "table", "register", "however", "june", "october",
    "november", "market", "library", "really", "action", "start", "series", "model", "features", "industry"
]);

// Words ranked by usefulness tiers (inverse of frequency)
// Tier 1: Words ranked ~100-500 in frequency - low usefulness
const TIER1_WORDS = new Set([
    "video", "audio", "image", "document", "editor", "viewer", "player", "browser",
    "window", "tab", "page", "panel", "menu", "toolbar", "sidebar", "button",
    "file", "folder", "directory", "save", "load", "open", "close", "copy",
    "paste", "delete", "move", "rename", "search", "find", "replace", "filter",
    "sort", "select", "edit", "view", "create", "update", "remove", "add"
]);

/**
 * Calculate how useful a word is for categorization purposes.
 * Common words (high frequency in general English) are less useful.
 * Specific/distinctive words are more useful.
 * 
 * @returns Score from 0 to 1, where 1 is most useful
 */
function getWordUsefulnessScore(word: string): number {
    const lower = word.toLowerCase();

    // Most common words - never useful
    if (COMMON_WORDS.has(lower)) return 0;

    // Tier 1 words - very low usefulness  
    if (TIER1_WORDS.has(lower)) return 0.2;

    // Short words tend to be less useful
    if (lower.length <= 4) return 0.4;

    // Everything else is potentially useful
    // Longer words and uncommon words get higher scores
    if (lower.length <= 6) return 0.7;
    if (lower.length <= 10) return 0.9;

    return 1.0; // Long, uncommon words are most distinctive
}

/**
 * Check if a word should be completely excluded (too generic to ever be useful)
 */
function shouldExcludeWord(word: string): boolean {
    // Exclude if word is too short
    if (word.length <= 3) return true;

    // Exclude numbers
    if (!Number.isNaN(Number(word))) return true;

    // Exclude words with usefulness score of 0
    return getWordUsefulnessScore(word) === 0;
}

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function generateRegexSuggestions(group: UncategorizedGroup): Promise<RegexSuggestion[]> {
    try {
        const suggestions: RegexSuggestion[] = [];
        const seen = new Set<string>();

        const addSuggestion = (label: string, regex: string, type: RegexSuggestion["type"], score: number = 0.5) => {
            const lowerRegex = regex.toLowerCase();
            if (!seen.has(lowerRegex) && !shouldExcludeWord(regex)) {
                suggestions.push({ label, regex, type, score });
                seen.add(lowerRegex);
            }
        };

        // 1. App Name (Exact) - if not too generic
        const escapedApp = escapeRegex(group.appName);
        const appScore = getWordUsefulnessScore(group.appName);
        if (appScore > 0) {
            addSuggestion(`App: ${group.appName}`, escapedApp, "app", appScore + 0.5); // Boost app names
        }

        // 2. Domain (if website) - domains are almost always useful
        if (group.isWebsite && group.domain) {
            const escapedDomain = escapeRegex(group.domain);
            addSuggestion(`Domain: ${group.domain}`, escapedDomain, "domain", 1.0);
        }

        // 3. Frequent words in titles with usefulness scoring
        const wordStats = new Map<string, { original: string; count: number; score: number }>();

        group.events.forEach(e => {
            const title = e.data.title;
            if (title && typeof title === "string") {
                // Split by separators commonly used in titles
                const parts = title.split(/\s+[-|:—]\s+/);

                parts.forEach((part, partIdx) => {
                    // Split part into words, preserving dots in the middle of words (like Next.js)
                    // but not at the end of sentences.
                    const words = part.split(/(?<!\.)\s+|\s+(?!\.)|[\/\\()\[\]{}!,?]/);

                    words.forEach((w, wordIdx) => {
                        // Clean up the word
                        const cleaned = w.replace(/^[^\w]+|[^\w]+$/g, '');
                        if (cleaned.length <= 2 || !Number.isNaN(Number(cleaned))) return;

                        const lower = cleaned.toLowerCase();
                        const usefulnessScore = getWordUsefulnessScore(lower);

                        // Skip words with 0 usefulness
                        if (usefulnessScore === 0) return;

                        // Identify position-based weight
                        // Words at the start or end of a part/title are often more significant
                        let posWeight = 1.0;
                        if (wordIdx === 0) posWeight += 0.3;
                        if (wordIdx === words.length - 1) posWeight += 0.2;
                        if (partIdx === 0) posWeight += 0.2;

                        const existing = wordStats.get(lower);
                        if (existing) {
                            existing.count += 1;
                            // Update score if this instance is "better" (e.g. better casing or position)
                            existing.score = Math.max(existing.score, usefulnessScore * posWeight);
                        } else {
                            wordStats.set(lower, { original: cleaned, count: 1, score: usefulnessScore * posWeight });
                        }
                    });
                });
            }
        });

        // Calculate final scores: frequency × usefulness
        // Words that appear often AND are distinctive get highest scores
        const scoredWords = Array.from(wordStats.entries())
            .map(([lower, { original, count, score }]) => {
                // Normalize count by total events
                const frequencyRatio = count / group.events.length;
                // Combined score: usefulness weighted higher than frequency
                const finalScore = score * 0.6 + frequencyRatio * 0.4;
                return { lower, original, count, finalScore };
            })
            .filter(w => w.count > 1 || w.count / group.events.length > 0.1) // Appear in at least 10% or more than once
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, 8); // Take top 8

        scoredWords.forEach(({ original, finalScore }) => {
            addSuggestion(`Word: ${original}`, original, "title", finalScore);

            // Also suggest App + Word composite if app name is useful
            if (group.appName && !group.isWebsite && appScore > 0.3) {
                addSuggestion(
                    `App + "${original}"`,
                    `${escapedApp}.*${original}`,
                    "composite",
                    finalScore * 0.9 // Slightly lower than word alone
                );
            }
        });

        // Sort all suggestions by score (highest first)
        suggestions.sort((a, b) => (b.score || 0) - (a.score || 0));

        return suggestions;
    } catch (error) {
        console.error("Error generating suggestions:", error);
        // Fallback to basic suggestions
        const fallbackSuggestions: RegexSuggestion[] = [];
        if (group.appName && group.appName.length > 3) {
            fallbackSuggestions.push({
                label: `App: ${group.appName}`,
                regex: escapeRegex(group.appName),
                type: "app",
                score: 0.5
            });
        }
        if (group.domain) {
            fallbackSuggestions.push({
                label: `Domain: ${group.domain}`,
                regex: escapeRegex(group.domain),
                type: "domain",
                score: 1.0
            });
        }
        return fallbackSuggestions;
    }
}


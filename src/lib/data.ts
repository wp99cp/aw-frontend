import { api } from "./api";
import { Event } from "./types";

export async function fetchAllEvents(start: Date, end: Date): Promise<Event[]> {
    try {
        // 1. Fetch all buckets to find the relevant IDs
        const bucketsMap = await api.getBuckets();
        const bucketIds = Object.keys(bucketsMap);

        // 2. Filter for relevant watchers
        // We want window, web, editors, afk, and our manual one.
        // We can just look for everything starting with aw-watcher- probably, 
        // but let's be slightly specific to avoid noise if there are others.
        // User specifically mentioned: afk, vscode, web-chrome, webstorm, window.

        const relevantPrefixes = [
            "aw-watcher-window",
            "aw-watcher-web",
            "aw-watcher-afk",
            "aw-watcher-editor", // generic
            "aw-watcher-vscode",
            "aw-watcher-jetbrains", // webstorm usually
            "aw-watcher-manual",
            "aw-watcher-webstorm" // explicit mention
        ];

        const targetBucketIds = bucketIds.filter(id =>
            relevantPrefixes.some(prefix => id.startsWith(prefix))
        );

        if (targetBucketIds.length === 0) {
            return [];
        }

        // 3. Construct query
        // We need to query each bucket and then merge.
        // merging many buckets might be heavy, but let's try.
        if (targetBucketIds.length === 0) {
            return [];
        }

        // Fetch events from each bucket in parallel
        // We use api.getEvents or api.query separately? 
        // api.getEvents is cleaner for raw events.

        const promises = targetBucketIds.map(async (bucketId) => {
            try {
                const events = await api.getEvents(bucketId, {
                    start: start.toISOString(),
                    end: end.toISOString()
                });
                // Inject bucketId into each event
                return events.map(e => ({ ...e, bucketId }));
            } catch (err) {
                console.warn(`Failed to fetch events for bucket ${bucketId}`, err);
                return [];
            }
        });

        const results = await Promise.all(promises);

        // Flatten and sort
        const allEvents = results.flat();

        // Sort events by timestamp descending
        allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return allEvents;

    } catch (error) {
        console.error("Failed to fetch all events", error);
        return [];
    }
}

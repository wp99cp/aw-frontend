import { Bucket, Event, CreateBucket, Query } from "./types";
import { Settings } from "./categories";

const API_BASE = "http://localhost:5600/api/0";

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${url}`, options);
    if (res.status === 304) {
        return null as unknown as T;
    }
    if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

export const api = {
    getBuckets: () => fetcher<{ [key: string]: Bucket }>("/buckets/"),

    getBucket: (bucketId: string) => fetcher<Bucket>(`/buckets/${bucketId}`),

    createBucket: (bucketId: string, payload: CreateBucket) =>
        fetcher<void>(`/buckets/${bucketId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),

    getEvents: (bucketId: string, params?: { start?: string; end?: string; limit?: number }) => {
        const searchParams = new URLSearchParams();
        if (params?.start) searchParams.append("start", params.start);
        if (params?.end) searchParams.append("end", params.end);
        if (params?.limit) searchParams.append("limit", params.limit.toString());

        return fetcher<Event[]>(`/buckets/${bucketId}/events?${searchParams.toString()}`);
    },

    createEvent: (bucketId: string, event: Event) =>
        fetcher<Event>(`/buckets/${bucketId}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([event]),
        }),

    deleteEvent: (bucketId: string, eventId: number) =>
        fetcher<void>(`/buckets/${bucketId}/events/${eventId}`, {
            method: "DELETE",
        }),

    query: (payload: Query) =>
        fetcher<unknown>("/query/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),

    async getSettings(): Promise<Settings> {
        return fetcher<Settings>("/settings");
    },

    async saveSettings(settings: Settings): Promise<void> {
        await fetcher("/settings/classes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings.classes),
        });
    },

    async createCategoryRule(categoryPath: string[], regex: string): Promise<void> {
        const settings = await this.getSettings();
        const newClass = {
            id: Date.now(), // Simple ID generation
            name: categoryPath,
            rule: { regex, type: "regex" },
            data: {}
        };
        settings.classes.unshift(newClass); // Add to top for priority? Or bottom? Usually top is higher priority in regex matching if first wins.
        // Actually, if it's first match wins, top is better.
        await this.saveSettings(settings);
    },
};

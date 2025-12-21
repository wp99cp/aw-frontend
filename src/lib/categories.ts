import { getEventPreview } from "./event-utils";
import { Event } from "./types";

export interface CategoryRule {
    regex: string;
    type: string;
}

export interface CategoryClass {
    id: number;
    name: string[]; // Hierarchy: ["Work", "Programming"]
    rule: CategoryRule;
    data: {
        color?: string;
        [key: string]: unknown;
    };
}

export interface Settings {
    classes: CategoryClass[];
    [key: string]: unknown;
}

export function classifyEvent(event: Event, classes: CategoryClass[]): string[] | null {
    // 1. Check for manual override
    if (Array.isArray(event.data.category) && event.data.category.length > 0) {
        return event.data.category as string[];
    }

    const textToMatch = `${event.data.app || ""} ${event.data.title || ""} ${event.data.url || ""}`;

    for (const cls of classes) {
        if (cls.rule.type === "regex") {
            try {
                const re = new RegExp(cls.rule.regex, "i"); // Case insensitive
                if (re.test(textToMatch)) {
                    return cls.name;
                }
            } catch {
                console.warn(`Invalid regex for category ${cls.name.join(">")}: ${cls.rule.regex}`);
            }
        }
    }

    return null; // Uncategorized
}

export interface SunburstNode {
    name: string;
    color?: string;
    value?: number;
    children: SunburstNode[];
    events: Event[];
}

export function buildSunburstData(events: Event[], classes: CategoryClass[]) {
    const root: SunburstNode = {
        name: "root",
        color: "#ffffff",
        children: [],
        events: [],
    };

    const uncategorized: SunburstNode = {
        name: "Uncategorized",
        color: "#cccccc",
        value: 0,
        children: [],
        events: []
    };

    // Fix: uncategorized matches SunburstNode if children is added.
    // Let's refine the interface.

    // Helper to find or create node in hierarchy
    const findOrCreateNode = (parent: SunburstNode, name: string, color?: string) => {
        let node = parent.children.find((c) => c.name === name);
        if (!node) {
            node = { name, children: [], value: 0, events: [] };
            if (color) node.color = color;
            parent.children.push(node);
        }
        return node;
    };

    events.forEach((event) => {
        const categoryPath = classifyEvent(event, classes);
        const duration = event.duration; // seconds

        // Add to root total events (optional, but good for completeness)
        root.events.push(event);

        if (!categoryPath) {
            uncategorized.value = (uncategorized.value || 0) + duration;
            uncategorized.events.push(event);
        } else {
            let currentNode = root;

            categoryPath.forEach((segment) => { // Removed index
                currentNode = findOrCreateNode(currentNode, segment);
                // Accumulate duration and events at each level
                currentNode.value = (currentNode.value || 0) + duration;
                currentNode.events.push(event);
            });

            // Add the event itself as a leaf node to the final category
            // This allows the sunburst to drill down one more level to see specific events
            const match = getEventPreview(event);
            const eventNode: SunburstNode = {
                name: match.primary,
                value: duration,
                events: [event], // Leaf node contains just this event
                children: []
            };
            currentNode.children.push(eventNode);
        }
    });

    if ((uncategorized.value || 0) > 0) {
        root.children.push(uncategorized);
    }

    return root;
}

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

export function classifyEvent(event: Event, classes: CategoryClass[]): { name: string[]; color?: string } | null {
    // 1. Check for manual override
    if (Array.isArray(event.data.category) && event.data.category.length > 0) {
        const categoryPath = event.data.category as string[];
        // Look up color from matching class
        let color: string | undefined;
        for (const cls of classes) {
            if (cls.name.length === categoryPath.length &&
                cls.name.every((n, i) => n === categoryPath[i])) {
                color = cls.data?.color;
                break;
            }
        }
        // If no exact match, check parent categories
        if (!color) {
            for (let len = categoryPath.length - 1; len > 0; len--) {
                const parentPath = categoryPath.slice(0, len);
                for (const cls of classes) {
                    if (cls.name.length === parentPath.length &&
                        cls.name.every((n, i) => n === parentPath[i])) {
                        color = cls.data?.color;
                        break;
                    }
                }
                if (color) break;
            }
        }
        return { name: categoryPath, color };
    }

    const textToMatch = `${event.data.app || ""} ${event.data.title || ""} ${event.data.url || ""}`;

    for (const cls of classes) {
        if (cls.rule.type === "regex") {
            try {
                const re = new RegExp(cls.rule.regex, "i"); // Case insensitive
                if (re.test(textToMatch)) {
                    return { name: cls.name, color: cls.data?.color };
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

    // Helper to find or create node in hierarchy
    const findOrCreateNode = (parent: SunburstNode, name: string, color?: string) => {
        let node = parent.children.find((c) => c.name === name);
        if (!node) {
            node = { name, children: [], value: 0, events: [] };
            if (color) node.color = color;
            parent.children.push(node);
        } else if (color && !node.color) {
            // Update color if it wasn't set (e.g. from a more specific rule)
            node.color = color;
        }
        return node;
    };

    events.forEach((event) => {
        const result = classifyEvent(event, classes);
        const duration = event.duration; // seconds

        // Add to root total events
        root.events.push(event);

        if (!result) {
            uncategorized.value = (uncategorized.value || 0) + duration;
            uncategorized.events.push(event);
        } else {
            const { name: categoryPath, color } = result;
            let currentNode = root;

            categoryPath.forEach((segment) => {
                // If we have a color for the whole path, apply it if not already set
                currentNode = findOrCreateNode(currentNode, segment, color);
                // Accumulate duration and events at each level
                currentNode.value = (currentNode.value || 0) + duration;
                currentNode.events.push(event);
            });

            // Add the event itself as a node (group by name to avoid duplicate keys)
            const match = getEventPreview(event);
            const leafNode = findOrCreateNode(currentNode, match.primary, color);
            leafNode.value = (leafNode.value || 0) + duration;
            leafNode.events.push(event);
        }
    });

    if ((uncategorized.value || 0) > 0) {
        const node = findOrCreateNode(root, uncategorized.name, uncategorized.color);
        node.value = (node.value || 0) + uncategorized.value!;
        node.events.push(...uncategorized.events);
    }

    return root;
}

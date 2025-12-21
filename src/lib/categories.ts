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
    const textToMatch = `${event.data.app || ""} ${event.data.title || ""} ${event.data.url || ""}`;

    for (const cls of classes) {
        if (cls.rule.type === "regex") {
            try {
                const re = new RegExp(cls.rule.regex, "i"); // Case insensitive
                if (re.test(textToMatch)) {
                    return cls.name;
                }
            } catch (e) {
                console.warn(`Invalid regex for category ${cls.name.join(">")}: ${cls.rule.regex}`);
            }
        }
    }

    return null; // Uncategorized
}

export function buildSunburstData(events: Event[], classes: CategoryClass[]) {
    const root: any = {
        name: "root",
        color: "#ffffff",
        children: [],
        events: [],
    };

    const uncategorized = {
        name: "Uncategorized",
        color: "#cccccc",
        value: 0,
        events: [] as Event[],
    };

    // Helper to find or create node in hierarchy
    const findOrCreateNode = (parent: any, name: string, color?: string) => {
        let node = parent.children.find((c: any) => c.name === name);
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
            uncategorized.value += duration;
            uncategorized.events.push(event);
        } else {
            let currentNode = root;

            categoryPath.forEach((segment, index) => {
                currentNode = findOrCreateNode(currentNode, segment);
                // Accumulate duration and events at each level
                currentNode.value += duration;
                currentNode.events.push(event);
            });
        }
    });

    if (uncategorized.value > 0) {
        root.children.push(uncategorized);
    }

    return root;
}

"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { calculateEffectiveDuration } from "@/lib/event-utils";
import { SunburstNode } from "@/lib/categories";

const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

export function CategorySummary({ data, timeRange }: { data: SunburstNode | null, timeRange: string }) {
    if (!data || !data.children || data.children.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Category Summary</CardTitle>
                    <CardDescription>Activity distribution</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No data available for {timeRange}</p>
                </CardContent>
            </Card>
        );
    }

    // Calculate totals for top-level categories using effective duration (handling overlaps)
    const categories = data.children.map((node: SunburstNode) => {
        return {
            name: node.name,
            total: calculateEffectiveDuration(node.events),
        };
    });

    // Sort by total duration desc
    categories.sort((a, b) => b.total - a.total);

    const totalTime = categories.reduce((acc, curr) => acc + curr.total, 0);

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Category Summary</CardTitle>
                <CardDescription>
                    Total: {formatDuration(totalTime)}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {categories.map((cat) => (
                    <div key={cat.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{cat.name}</span>
                            <span className="text-muted-foreground">{formatDuration(cat.total)}</span>
                        </div>
                        {/* Custom Progress Bar */}
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary"
                                style={{ width: `${totalTime > 0 ? (cat.total / totalTime) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

"use client";

import { useState, useEffect } from "react";
import { ResponsiveSunburst } from "@nivo/sunburst";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SunburstChart({ data, onCategorySelect }: { data: any, onCategorySelect?: (node: any) => void }) {
    const [root, setRoot] = useState(data);

    useEffect(() => {
        setRoot(data);
    }, [data]);

    if (!data || data.children.length === 0) {
        return <div className="h-full flex items-center justify-center text-muted-foreground">No data to display</div>;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleNodeClick = (node: any) => {
        // Update view if there are children to drill down into
        if (node.data.children && node.data.children.length > 0) {
            setRoot(node.data);
        } else {
            // Notify parent about selection only if it's a leaf
            if (onCategorySelect) {
                onCategorySelect(node.data);
            }
        }
    };

    const handleReset = () => {
        setRoot(data);
        if (onCategorySelect) {
            onCategorySelect(null);
        }
    };

    return (
        <div className="h-full relative">
            {root.name !== "root" && (
                <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 z-10 h-8 px-2"
                    onClick={handleReset}
                >
                    <RotateCcw className="mr-2 h-3 w-3" />
                    Reset
                </Button>
            )}
            <ResponsiveSunburst
                data={root}
                margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                id="name"
                value="value"
                cornerRadius={2}
                borderColor={{ theme: 'background' }}
                colors={{ scheme: 'nivo' }}
                childColor={{
                    from: 'color',
                    modifiers: [
                        [
                            'brighter',
                            0.1
                        ]
                    ]
                }}
                enableArcLabels={true}
                arcLabel={(e) => e.data.name + ' (' + Math.round(e.value / 60) + 'm)'} // Show minutes
                arcLabelsSkipAngle={10}
                arcLabelsTextColor={{
                    from: 'color',
                    modifiers: [
                        [
                            'darker',
                            1.4
                        ]
                    ]
                }}
                onClick={handleNodeClick}
                motionConfig="gentle"
                transitionMode="pushIn"
            />
        </div>
    );
}

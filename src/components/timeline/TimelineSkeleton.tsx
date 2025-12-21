"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TimelineSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="w-full border rounded-lg bg-background shadow-sm flex flex-col">
                {/* Header-like bar */}
                <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                    <Skeleton className="h-4 w-64" />
                </div>

                <div className="p-4 space-y-8">
                    {/* Manual Lane Skeleton */}
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-16 w-full rounded-md" />
                    </div>

                    {/* Time Axis Skeleton */}
                    <div className="relative h-6 w-full border-y flex items-center">
                        {[...Array(12)].map((_, i) => (
                            <div key={i} className="flex-1 flex justify-center">
                                <Skeleton className="h-2 w-8" />
                            </div>
                        ))}
                    </div>

                    {/* Auto Lane Skeleton */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-3 w-40" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-12 w-full rounded-md" />
                    </div>
                </div>
            </div>

            {/* Selection Card Skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 space-y-4 border-2 border-dashed rounded-lg bg-muted/5">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

"use client";

import { use } from "react";
import EditEventForm from "@/components/events/EditEventForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Params = Promise<{ bucketId: string; id: string }>;

export default function EditEventPage({ params }: { params: Params }) {
    const { bucketId, id } = use(params);
    const eventId = parseInt(id);

    return (
        <div className="container mx-auto max-w-2xl py-10">
            <Card>
                <CardHeader>
                    <CardTitle>Edit Event</CardTitle>
                    <CardDescription>
                        Modify event details.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <EditEventForm
                        bucketId={bucketId}
                        eventId={eventId}
                        onSave={() => window.location.href = "/events"} // Full nav or router push
                    />
                </CardContent>
            </Card>
        </div>
    );
}

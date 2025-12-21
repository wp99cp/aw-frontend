"use client";

import { use, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { EditEventForm } from "@/components/events/EditEventForm";

type Params = Promise<{ bucketId: string; id: string }>;

export default function EditEventModal({ params }: { params: Params }) {
    const router = useRouter();
    // In Next.js 15+, params are promises.
    // However, if we are in client component, we should unwrap it.
    // But since this is a page, we receive it as prop.
    // To be safe with "use client" interacting with params, let's use `use` or async await but pages are simpler.
    // Next.js 15 requires awaiting params in server components, but here we are client.
    // Actually, even in client components, we might receive promise params in new versions.
    // Let's use `use` hook which is available now for this unwrapping.
    const { bucketId, id } = use(params);
    const eventId = parseInt(id);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            router.back();
        }
    };

    return (
        <Dialog defaultOpen={true} open={true} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-background">
                <DialogHeader>
                    <DialogTitle>Edit Event</DialogTitle>
                    <DialogDescription>
                        Modify event details. Note: This creates a new event copy.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <EditEventForm
                        bucketId={bucketId}
                        eventId={eventId}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

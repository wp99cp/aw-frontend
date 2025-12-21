"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { EventForm } from "@/components/events/EventForm";

export default function AddEventModal() {
    const router = useRouter();

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            router.back();
        }
    };

    return (
        <Dialog defaultOpen={true} open={true} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-background">
                <DialogHeader>
                    <DialogTitle>Log Activity</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <EventForm />
                </div>
            </DialogContent>
        </Dialog>
    );
}

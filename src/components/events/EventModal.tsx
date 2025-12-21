"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Event } from "@/lib/types";
import EditEventForm from "./EditEventForm";

interface EventModalProps {
    event: Event | null;
    isOpen: boolean;
    onClose: () => void;
    onSave?: () => void;
}

export function EventModal({ event, isOpen, onClose, onSave }: EventModalProps) {
    if (!event) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
                <DialogHeader>
                    <DialogTitle>Edit Event</DialogTitle>
                    <DialogDescription>
                        View and modify event details.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    {event.bucketId && event.id !== undefined && (
                        <EditEventForm
                            bucketId={event.bucketId}
                            eventId={event.id}
                            initialData={event}
                            onSave={() => {
                                if (onSave) onSave();
                                onClose();
                            }}
                            onCancel={() => onClose()}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

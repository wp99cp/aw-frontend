"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { Event } from "@/lib/types";
import { fetchAllEvents } from "@/lib/data";
import { toast } from "sonner";

interface EventsContextType {
    events: Event[];
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
    loading: boolean;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    date: Date;
    setDate: React.Dispatch<React.SetStateAction<Date>>;
    fetchEvents: () => Promise<void>;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export function EventsProvider({ children }: { children: ReactNode }) {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [date, setDate] = useState<Date>(new Date());

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            const allEvents = await fetchAllEvents(start, end);
            // Sort by timestamp desc
            allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setEvents(allEvents);
        } catch (err) {
            console.error(err);
            toast.error("Failed to fetch events");
        } finally {
            setLoading(false);
        }
    }, [date]);

    // Initial fetch when date changes
    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    return (
        <EventsContext.Provider value={{ events, setEvents, loading, setLoading, date, setDate, fetchEvents }}>
            {children}
        </EventsContext.Provider>
    );
}

export function useEvents() {
    const context = useContext(EventsContext);
    if (context === undefined) {
        throw new Error("useEvents must be used within an EventsProvider");
    }
    return context;
}

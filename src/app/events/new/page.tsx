import { EventForm } from "@/components/events/EventForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewEventPage() {
    return (
        <div className="max-w-xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Log Manual Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <EventForm />
                </CardContent>
            </Card>
        </div>
    );
}

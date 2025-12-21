"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsPage() {
    const [settingsJson, setSettingsJson] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const s = await api.getSettings();
            setSettingsJson(JSON.stringify(s, null, 2));
        } catch (e) {
            console.error(e);
            setSettingsJson("{}");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const parsed = JSON.parse(settingsJson);
            await api.saveSettings(parsed);
            alert("Settings saved!");
            loadSettings();
        } catch (e) {
            alert("Invalid JSON");
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold">Settings</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Raw Configuration</CardTitle>
                    <CardDescription>
                        Edit your categories and rules directly (JSON).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <div>Loading...</div>
                    ) : (
                        <Textarea
                            className="font-mono h-[500px]"
                            value={settingsJson}
                            onChange={(e) => setSettingsJson(e.target.value)}
                        />
                    )}
                    <Button onClick={handleSave}>Save Changes</Button>
                </CardContent>
            </Card>
        </div>
    );
}

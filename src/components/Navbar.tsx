"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";

export function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    const routes = [
        { href: "/", label: "Dashboard" },
        { href: "/events", label: "Events" },
        { href: "/rules", label: "Rules" },
        { href: "/wizard", label: "Wizard" },
        { href: "/stats", label: "Reports" },
    ];

    return (
        <nav className="mx-auto max-w-6xl mt-6 rounded-2xl border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6 lg:px-8 sticky top-4 z-50">
            <div className="flex h-16 items-center">
                {/* Desktop Logo */}
                <div className="mr-4 hidden md:flex">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <span className="hidden font-bold sm:inline-block">
                            AW Activities
                        </span>
                    </Link>
                    <div className="flex items-center space-x-6 text-sm font-medium">
                        {routes.map((route) => (
                            <Link
                                key={route.href}
                                href={route.href}
                                className="transition-colors hover:text-foreground/80 text-foreground/60"
                            >
                                {route.label}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Mobile Menu */}
                <div className="flex md:hidden items-center">
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-2">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle Menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="pr-0">
                            <SheetHeader>
                                <SheetTitle className="text-left px-2">AW Activities</SheetTitle>
                            </SheetHeader>
                            <div className="flex flex-col space-y-3 mt-4">
                                {routes.map((route) => (
                                    <Link
                                        key={route.href}
                                        href={route.href}
                                        onClick={() => setIsOpen(false)}
                                        className="px-2 py-1 text-lg font-medium transition-colors hover:text-primary"
                                    >
                                        {route.label}
                                    </Link>
                                ))}
                                <Link
                                    href="/settings"
                                    onClick={() => setIsOpen(false)}
                                    className="px-2 py-1 text-lg font-medium transition-colors hover:text-primary"
                                >
                                    Settings
                                </Link>
                            </div>
                        </SheetContent>
                    </Sheet>
                    <Link href="/" className="font-bold">
                        AW Activities
                    </Link>
                </div>

                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        {/* Search/Command could go here */}
                    </div>
                    <nav className="flex items-center">
                        <Button variant="ghost" asChild className="hidden md:flex">
                            <Link href="/settings">Settings</Link>
                        </Button>
                    </nav>
                </div>
            </div>
        </nav>
    );
}


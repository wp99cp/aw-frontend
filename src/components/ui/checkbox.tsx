"use client"

import * as React from "react"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

// Since Radix Checkbox might not be installed, let's try to simulate it or use standard input
// But looking at package.json, @radix-ui/react-checkbox is NOT in dependencies.
// However, the user asked for a "next level" page so maybe I should use the proper component or a custom one.
// Let's build a custom one using standard input hidden but styled div, OR install the dependency.
// But I cannot run `npm install`.
// So I will create a pure Tailwind implementation that looks like Shadcn.

const Checkbox = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
    <div className="relative flex items-center">
        <input
            type="checkbox"
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground accent-primary",
                className
            )}
            ref={ref}
            {...props}
        />
    </div>
))
Checkbox.displayName = "Checkbox"

export { Checkbox }

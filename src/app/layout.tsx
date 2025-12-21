import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import { EventsProvider } from "@/context/EventsContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ActivityWatch Tracker",
  description: "Track your time manually and view stats",
};

export default function RootLayout({
  children,
  modal
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className}`}
      >
        <Navbar />
        <main className="container py-8 md:py-12 lg:py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <EventsProvider>
            {children}
            {modal}
          </EventsProvider>
          <Toaster />
        </main>
      </body>
    </html>
  );
}

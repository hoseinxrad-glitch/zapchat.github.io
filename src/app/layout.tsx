import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZapChat — Fast, Private, Open-source Messenger",
  description: "A modern, real-time messaging app built with Next.js + Socket.io. Better than Telegram: no phone number, encrypted, open source.",
  keywords: ["ZapChat", "messenger", "chat", "real-time", "open source", "private", "Socket.io"],
  authors: [{ name: "ZapChat" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "ZapChat — Fast, Private Messenger",
    description: "Real-time messaging without phone numbers. Open source.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZapChat",
    description: "Real-time messaging without phone numbers. Open source.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuestForge — BOTCHAIN quests",
  description: "Create quests. Complete missions. Earn BOT on-chain.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "QuestForge — BOTCHAIN quests",
    description: "Create quests. Complete missions. Earn BOT on-chain.",
    images: [{ url: "/logo.png", width: 1024, height: 1024, alt: "QuestForge logo" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

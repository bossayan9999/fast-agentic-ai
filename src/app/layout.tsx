import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fast Agentic AI Engineering Loop",
  description:
    "Full-stack agentic AI system with OpenRouter, Obsidian-style GitHub vault, and Cloudflare-ready deployment",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

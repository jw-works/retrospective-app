import type { Metadata } from "next";
import "./globals.css";

// Root app shell that injects global styles and shared HTML/body wrappers.
export const metadata: Metadata = {
  title: "Dashboard Mock",
  description: "Retrospective dashboard built with Next.js, Tailwind CSS, and shadcn/ui"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

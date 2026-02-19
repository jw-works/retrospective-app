import type { Metadata } from "next";
import Script from "next/script";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const key = "retro.theme";
              const saved = localStorage.getItem(key);
              const isDark = saved === "dark" || (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
              document.documentElement.classList.toggle("dark", isDark);
            } catch {}
          })();`}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}

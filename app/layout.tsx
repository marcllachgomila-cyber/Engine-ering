import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Engine Builder - Marc Llach Gomila",
  description: "Design your own engine, run a 10-second acceleration test, and find its closest real-world match.",
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Kept in sync with the gradient layer in app/globals.css - only the url()
// needs to move here so it can be prefixed with basePath for GitHub Pages.
const backgroundImage = [
  "linear-gradient(100deg, rgba(15, 14, 12, 0.86) 0%, rgba(15, 14, 12, 0.72) 38%, rgba(15, 14, 12, 0.4) 68%, rgba(15, 14, 12, 0.6) 100%)",
  `url(${basePath}/workshop-bg.png)`,
].join(", ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ backgroundImage }}
      >
        {children}
      </body>
    </html>
  );
}

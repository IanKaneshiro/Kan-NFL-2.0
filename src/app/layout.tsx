import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kan NFL Pick'em",
  description: "Brother pick'em for the NFL regular season",
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

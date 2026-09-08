import type { Metadata, Viewport } from "next";
import { SiteChrome } from "@/components/site-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kan NFL Pick'em",
  description: "Brother pick'em for the NFL regular season",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Kan NFL",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}

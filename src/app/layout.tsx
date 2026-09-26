import type { Metadata, Viewport } from "next";
import PWARegistration from "@/components/PWARegistration";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0284c7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://mriiq.fit"),
  title: {
    default: "MRIIQ — Prior Authorization Intelligence System",
    template: "%s | MRIIQ",
  },
  description:
    "Enterprise Lumbar Spine MRI Prior Authorization platform powered by LangGraph Human-in-the-Loop, OpenAI gpt-5.6-terra, SOAP clinical records, and grounded RAG.",
  applicationName: "MRIIQ",
  authors: [{ name: "QuantIQ Health Systems" }],
  generator: "Next.js",
  keywords: [
    "Prior Authorization",
    "MRI",
    "HealthTech",
    "LangGraph",
    "OpenAI",
    "SOAP Notes",
    "Clinical RAG",
    "Lumbar Spine MRI",
    "CPT 72148",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MRIIQ",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/favicon-32x32.png",
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://mriiq.fit",
    siteName: "MRIIQ Prior Authorization Intelligence",
    title: "MRIIQ — Prior Authorization Intelligence System",
    description:
      "Enterprise MRI Prior Authorization Engine with Agentic AI, LangGraph HITL, and Grounded Clinical RAG.",
    images: [
      {
        url: "/icons/og-image.png",
        width: 1200,
        height: 630,
        alt: "MRIIQ Prior Authorization Intelligence App Icon",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MRIIQ — Prior Authorization Intelligence System",
    description:
      "Enterprise MRI Prior Authorization Engine with Agentic AI, LangGraph HITL, and Grounded Clinical RAG.",
    images: ["/icons/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MRIIQ" />
      </head>
      <body>
        <PWARegistration />
        {children}
      </body>
    </html>
  );
}

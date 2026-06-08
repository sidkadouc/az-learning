import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Mailroom IA",
  description: "Tri automatique des courriers physiques scannés",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}

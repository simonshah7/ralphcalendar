import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampaignOS - Marketing Campaign Planning",
  description: "Marketing campaign planning tool with timeline visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

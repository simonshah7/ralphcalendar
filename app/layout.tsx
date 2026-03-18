import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchGrid - Marketing Campaign Planning",
  description: "Marketing campaign planning tool with timeline visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

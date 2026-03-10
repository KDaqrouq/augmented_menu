import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Augmented Menu",
  description: "QR-accessible menu with AR item viewing",
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

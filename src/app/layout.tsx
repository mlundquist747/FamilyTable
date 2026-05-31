import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FamilyTable — AI meal planning for your whole household",
  description:
    "FamilyTable plans a week of dinners around every family member's diet, allergies and schedule, then builds a smart, shareable grocery list.",
};

export const viewport: Viewport = {
  themeColor: "#4F8257",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

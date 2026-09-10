import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = { title: "BRANDLY", description: "Telegram bot interface demo" };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ru"><body style={{ margin: 0, fontFamily: "Arial, sans-serif" }}>{children}</body></html>;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
export const metadata: Metadata = { title: "BRANDLY", description: "Telegram bot interface demo" };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ru"><body style={{ margin: 0, fontFamily: "Arial, sans-serif" }}><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />{children}</body></html>;
}

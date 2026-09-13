import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import localFont from "next/font/local";

const inter = localFont({ src: "../public/fonts/InterVariable.woff2", variable: "--font-inter", display: "swap" });
export const metadata: Metadata = { title: "BRANDLY", description: "Telegram bot interface demo" };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ru" className={inter.variable}><body style={{ margin: 0, fontFamily: 'var(--font-inter), sans-serif' }}><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />{children}</body></html>;
}

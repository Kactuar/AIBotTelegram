import Link from "next/link";
export default function HomePage() {
  return <main style={{ maxWidth: 560, margin: "80px auto", padding: 24 }}><h1>BRANDLY</h1><p>Telegram-бот для создания роликов.</p><Link href="/mini-app">Открыть Mini App</Link></main>;
}

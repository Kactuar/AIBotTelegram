import LegalBackButton from "../LegalBackButton";

export default async function OfferPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const language = (await searchParams).lang === "en" ? "en" : "ru";
  const english = language === "en";
  return <main style={{ maxWidth: 560, margin: "40px auto", padding: 24, fontFamily: "Arial, sans-serif" }}><LegalBackButton english={english} /><h1>{english ? "Public offer" : "Публичная оферта"}</h1><p>{english ? "This is a temporary placeholder. The complete legal text will be published before real payments launch." : "Это временная страница-заглушка. Полный юридический текст будет опубликован до запуска реальных платежей."}</p></main>;
}
